#!/usr/bin/env node
// Imports a converted .companionconfig into a real headless Companion, enables the two module connections
// against fake backends, and presses the imported buttons: proves the converted config works end to end.
// Run via tools/smoke/verify-config.sh <file.companionconfig>.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

import { startFakeControlSocket } from './fixtures/fakeControlSocket.mjs'
import { startFakeGamemodeService } from './fixtures/fakeGamemode.mjs'
import { startFakePlayer } from './fixtures/fakePlayer.mjs'
import { launchCompanion } from './lib/launchCompanion.mjs'
import { makeRestClient } from './lib/rest.mjs'
import { connectTrpc, mutate, subscribeOnce } from './lib/trpcWs.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COMPANION_REPO = process.env.COMPANION_SMOKE_REPO || '/var/lib/hermes/workspace/cm-smoke/companion'
const SOCKET = 'mangohud'

function requireEnv(name) {
	const value = process.env[name]
	if (!value) {
		console.error(`${name} is not set - run this via tools/smoke/verify-config.sh`)
		process.exit(2)
	}
	return value
}
const configFile = process.argv[2]
if (!configFile || !fs.existsSync(configFile)) {
	console.error('usage: verify-config.sh <file.companionconfig>')
	process.exit(2)
}
const busAddress = requireEnv('DBUS_SESSION_BUS_ADDRESS')
const modulesPath = requireEnv('COMPANION_SMOKE_MODULES_PATH')
const configDir = requireEnv('COMPANION_SMOKE_CONFIG_DIR')
const scratchHome = requireEnv('COMPANION_SMOKE_HOME')

const results = []
const record = (name, pass, detail = '') => {
	results.push({ name, pass, detail: String(detail) })
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, { timeoutMs = 15_000, label = 'condition' } = {}) {
	const start = Date.now()
	let last
	while (Date.now() - start < timeoutMs) {
		try {
			const v = await fn()
			if (v) return v
		} catch (e) {
			last = e
		}
		await sleep(250)
	}
	throw new Error(`timed out waiting for ${label}${last ? `: ${last.message}` : ''}`)
}

// Expected shape, read from the file itself
const raw = fs.readFileSync(configFile)
const expected = JSON.parse((raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw).toString('utf8'))
const expectedPages = Object.values(expected.pages).map((p) => ({
	name: p.name,
	buttons: Object.values(p.controls).flatMap((row) => Object.values(row)).length,
}))

// Fake world
const mangoDir = path.join(scratchHome, '.config', 'MangoHud')
fs.mkdirSync(mangoDir, { recursive: true })
fs.writeFileSync(path.join(mangoDir, 'MangoHud.conf'), `control=${SOCKET}\npreset=0,1,2\n`)
fs.writeFileSync(path.join(mangoDir, 'game.conf'), 'preset=0\n')
const player = await startFakePlayer(busAddress, 'smoketest', {
	title: 'Config Song',
	artist: ['Config Artist'],
	volume: 0.5,
})
const gamemode = await startFakeGamemodeService(busAddress)
const socket = await startFakeControlSocket(SOCKET)

const companion = await launchCompanion({ companionRepo: COMPANION_REPO, configDir, modulesPath, env: { HOME: scratchHome } })
console.log(`Companion up at ${companion.url}`)
const rest = makeRestClient(companion.url)
const { client: trpc, close: closeTrpc } = connectTrpc(companion.url)

try {
	// 1. import through the real import flow
	const imp = spawnSync('node', [path.join(__dirname, 'import-config.mjs'), configFile, companion.url], { encoding: 'utf8' })
	record('import completed', imp.status === 0 && imp.stdout.includes('import completed'), imp.status === 0 ? '' : imp.stderr.slice(-400))

	// 2. pages and button counts
	const init = await subscribeOnce(trpc, 'pages.watch', undefined)
	const pages = init.order.map((id) => ({
		name: init.pages[id].name,
		buttons: Object.values(init.pages[id].controls || {}).flatMap((row) => Object.values(row)).filter(Boolean).length,
	}))
	record('pages and button counts equal the file', JSON.stringify(pages) === JSON.stringify(expectedPages), `${JSON.stringify(pages)} vs ${JSON.stringify(expectedPages)}`)

	// 3. connections: imported disabled; enable the two module ones against the fake world
	const conns = await rest.getJson('/api/connections')
	const byLabel = Object.fromEntries(conns.map((c) => [c.label, c]))
	record('connections media, mangohud and discord exist', ['media', 'mangohud', 'discord'].every((l) => byLabel[l]), conns.map((c) => c.label).join(','))
	record('module connections point at the dev modules', byLabel.media?.moduleId === 'linux-media' && byLabel.mangohud?.moduleId === 'mangohud')
	await mutate(trpc, 'instances.connections.setConfig', {
		connectionId: byLabel.media.id,
		label: 'media',
		enabled: true,
		config: { player: 'auto', busAddress },
	})
	await mutate(trpc, 'instances.connections.setConfig', {
		connectionId: byLabel.mangohud.id,
		label: 'mangohud',
		enabled: true,
		config: {
			configDir: '',
			controlSocket: SOCKET,
			cycleOrder: '1,2,0',
			presetLabels: '0=Off, 1=Bar, 2=Detail',
			updatePerAppConfigs: true,
			busAddress,
			sensorPollMs: 2000,
			gamescopePollMs: 2000,
		},
	})
	for (const [label, id] of [['media', byLabel.media.id], ['mangohud', byLabel.mangohud.id]]) {
		const s = await waitFor(async () => {
			const st = await rest.getJson(`/api/connections/${id}/status`)
			return st.status?.category === 'good' ? st : null
		}, { label: `${label} status good` })
		record(`${label} connection reaches good status`, true, JSON.stringify(s.status))
	}

	// 4. variables referenced by the imported buttons resolve
	await waitFor(async () => (await rest.getText('/api/variable/media/title/value')).text === 'Config Song', { label: 'media title' })
	record('media variables resolve ($(media:title) etc.)', true)
	const preset0 = await waitFor(async () => (await rest.getText('/api/variable/mangohud/preset/value')).text === '0', { label: 'preset 0' })
	record('mangohud preset variable reads 0 from MangoHud.conf', !!preset0)

	// 5. press imported buttons (page, row, column are the imported layout)
	const press = (page, row, col) => rest.post(`/api/location/${page}/${row}/${col}/press`)
	const iface = () => player.interface

	let before = iface().playPauseCalls
	await press(1, 1, 2)
	await waitFor(() => iface().playPauseCalls > before, { label: 'PLAY', timeoutMs: 5000 })
	record('MUSIC PLAY button reaches the player (PlayPause)', true)

	before = iface().nextCalls
	await press(1, 1, 3)
	await waitFor(() => iface().nextCalls > before, { label: 'NEXT', timeoutMs: 5000 })
	record('MUSIC NEXT button reaches the player', true)

	before = iface().previousCalls
	await press(1, 1, 1)
	await waitFor(() => iface().previousCalls > before, { label: 'PREV', timeoutMs: 5000 })
	record('MUSIC PREV button reaches the player', true)

	const volBefore = iface().volume
	await press(1, 2, 2)
	await waitFor(() => iface().volume > volBefore, { label: 'VOL+', timeoutMs: 5000 })
	record('MUSIC VOL + raises the player volume', true, `${volBefore} -> ${iface().volume}`)

	await press(1, 1, 4)
	await waitFor(() => iface().shuffle === true, { label: 'shuffle', timeoutMs: 5000 })
	record('MUSIC SHUFFLE toggles shuffle on', true)
	await waitFor(async () => (await rest.getText('/api/variable/media/shuffle/value')).text === 'on', { label: 'shuffle var' })
	record('shuffle variable follows', true)

	await press(1, 2, 3)
	await waitFor(() => iface().loopStatus === 'Playlist', { label: 'loop', timeoutMs: 5000 })
	record('MUSIC REPEAT cycles loop to Playlist', true)

	const mainConf = () => fs.readFileSync(path.join(mangoDir, 'MangoHud.conf'), 'utf8')
	await press(3, 0, 1)
	await waitFor(() => /^preset=1,2,0$/m.test(mainConf()), { label: 'BAR' })
	record('GAMING BAR writes preset=1,2,0', true)
	await press(3, 0, 2)
	await waitFor(() => /^preset=2,1,0$/m.test(mainConf()), { label: 'DETAIL' })
	record('GAMING DETAIL writes preset=2,1,0', true)
	await press(3, 0, 3)
	await waitFor(() => /^preset=0,1,2$/m.test(mainConf()), { label: 'OFF' })
	record('GAMING OFF writes preset=0,1,2', true)
	await press(3, 0, 4)
	await waitFor(async () => (await rest.getText('/api/variable/mangohud/preset/value')).text === '1', { label: 'cycle' })
	record('GAMING cycle button advances 0 -> 1', true)
	record('per-app game.conf follows', /^preset=/m.test(fs.readFileSync(path.join(mangoDir, 'game.conf'), 'utf8')))
	const name = await rest.getText('/api/variable/mangohud/preset_name/value')
	record('preset_name variable follows the labels', name.text === 'Bar', name.text)

	// 6. nothing left over from the old setup
	const exported = await (await fetch(`${companion.url}/int/export/full?format=json`)).text()
	record('export holds no custom: references and no HTTP bridge', !exported.includes('custom:') && !exported.includes('127.0.0.1:8899') && !exported.includes('generic-http'))
	record('export holds no Discord credentials', !/clientSecret|accessToken|refreshToken/.test(exported))
} catch (err) {
	record(`crashed: ${err.message}`, false, err.stack)
} finally {
	console.log('--- tearing down ---')
	await player.disconnect().catch(() => {})
	await gamemode.disconnect().catch(() => {})
	await socket.close().catch(() => {})
	closeTrpc()
	await companion.stop()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.name}: ${f.detail}`)
process.exitCode = failed.length ? 1 : 0

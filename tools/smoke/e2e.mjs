#!/usr/bin/env node
// End-to-end smoke test: boots a real headless Companion with both dev modules loaded under
// Companion's real permission model, drives them purely over the REST/tRPC APIs a real admin
// client would use, and checks the modules actually reach fake MPRIS/D-Bus/socket backends.
// Run via tools/smoke/run.sh, which sets up the environment this script expects.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { launchCompanion } from './lib/launchCompanion.mjs'
import { connectTrpc, mutate, subscribeOnce } from './lib/trpcWs.mjs'
import { makeRestClient } from './lib/rest.mjs'
import { startFakePlayer } from './fixtures/fakePlayer.mjs'
import { startFakeGamemodeService } from './fixtures/fakeGamemode.mjs'
import { startFakeControlSocket } from './fixtures/fakeControlSocket.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const COMPANION_REPO = process.env.COMPANION_SMOKE_REPO || '/var/lib/hermes/workspace/cm-smoke/companion'
const CONTROL_SOCKET_NAME = 'mangohud-smoke'

function requireEnv(name) {
	const value = process.env[name]
	if (!value) {
		console.error(`${name} is not set - run this via tools/smoke/run.sh, not directly`)
		process.exit(2)
	}
	return value
}

const busAddress = requireEnv('DBUS_SESSION_BUS_ADDRESS')
const modulesPath = requireEnv('COMPANION_SMOKE_MODULES_PATH')
const configDir = requireEnv('COMPANION_SMOKE_CONFIG_DIR')
const scratchHome = requireEnv('COMPANION_SMOKE_HOME')

const results = []
function record(name, pass, detail = '') {
	results.push({ name, pass, detail: String(detail) })
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`)
}

async function waitFor(fn, { timeoutMs = 15_000, intervalMs = 300, label = 'condition' } = {}) {
	const start = Date.now()
	let lastErr
	while (Date.now() - start < timeoutMs) {
		try {
			const value = await fn()
			if (value) return value
		} catch (err) {
			lastErr = err
		}
		await new Promise((r) => setTimeout(r, intervalMs))
	}
	throw new Error(`Timed out waiting for ${label}${lastErr ? `: ${lastErr.message}` : ''}`)
}

// ---- MangoHud config dir (default resolution: $HOME/.config/MangoHud, HOME forwarded by Companion) ----
const mangohudConfigDir = path.join(scratchHome, '.config', 'MangoHud')
fs.mkdirSync(mangohudConfigDir, { recursive: true })
fs.writeFileSync(path.join(mangohudConfigDir, 'MangoHud.conf'), `control=${CONTROL_SOCKET_NAME}\npreset=0,1,2\n`)
fs.writeFileSync(path.join(mangohudConfigDir, 'game.conf'), 'preset=0\n')
fs.writeFileSync(path.join(mangohudConfigDir, 'presets.conf'), '[preset 0]\nfps\n\n[preset 1]\nfps,frametime\n')

// ---- Fakes ----
const fakePlayerFixtures = []
async function makeFakePlayer(initial) {
	const player = await startFakePlayer(busAddress, 'smoketest', initial)
	fakePlayerFixtures.push(player)
	return player
}

let fakePlayer = await makeFakePlayer({ title: 'Smoke Song', artist: ['Smoke Artist'] })
console.log(`fake MPRIS player up: ${fakePlayer.busName}`)

const fakeGamemode = await startFakeGamemodeService(busAddress)
console.log('fake gamemode service up')

const fakeSocket = await startFakeControlSocket(CONTROL_SOCKET_NAME)
console.log(`fake control socket up: \\0${CONTROL_SOCKET_NAME}`)

// ---- Companion ----
console.log(`launching Companion (configDir=${configDir}, modulesPath=${modulesPath})`)
const companion = await launchCompanion({
	companionRepo: COMPANION_REPO,
	configDir,
	modulesPath,
	env: { HOME: scratchHome },
})
console.log(`Companion up at ${companion.url}`)

const rest = makeRestClient(companion.url)
const { client: trpc, close: closeTrpc } = connectTrpc(companion.url)

async function buttonAt(pageNumber, row, column) {
	await mutate(trpc, 'controls.resetControls', {
		locations: [{ pageNumber, row, column }],
		newType: 'button-layered',
	})
	const pagesInit = await subscribeOnce(trpc, 'pages.watch', undefined)
	// pages.watch's `pages` is keyed by opaque page id, not page number; `order` maps 1-based
	// pageNumber -> id (see companion/shared-lib/lib/Model/PageModel.ts PageModelChangesInit).
	const pageId = pagesInit.order[pageNumber - 1]
	return pagesInit.pages[pageId]?.controls?.[row]?.[column]
}

async function addAction(controlId, connectionId, entityDefinition) {
	return mutate(trpc, 'controls.entities.add', {
		controlId,
		entityLocation: { stepId: '0', setId: 'down' },
		ownerId: null,
		connectionId,
		entityType: 'action',
		entityDefinition,
	})
}

try {
	// === create both connections, without the inspector (permissions on) ===
	const mediaConnectionId = await mutate(trpc, 'instances.connections.add', {
		module: { type: 'linux-media' },
		label: 'media',
		versionId: 'dev',
	})
	console.log(`created connection media = ${mediaConnectionId}`)

	const mangohudConnectionId = await mutate(trpc, 'instances.connections.add', {
		module: { type: 'mangohud' },
		label: 'mangohud',
		versionId: 'dev',
	})
	console.log(`created connection mangohud = ${mangohudConnectionId}`)

	await mutate(trpc, 'instances.connections.setConfig', {
		connectionId: mediaConnectionId,
		label: 'media',
		enabled: true,
		config: { player: 'auto', busAddress },
	})

	await mutate(trpc, 'instances.connections.setConfig', {
		connectionId: mangohudConnectionId,
		label: 'mangohud',
		enabled: true,
		config: {
			configDir: '',
			controlSocket: CONTROL_SOCKET_NAME,
			cycleOrder: '1,2,0',
			presetLabels: '0=Off,1=Bar,2=Detail',
			updatePerAppConfigs: true,
			busAddress,
			sensorPollMs: 2000,
			gamescopePollMs: 2000,
		},
	})

	// === both connections reach OK status ===
	const mediaStatus = await waitFor(
		async () => {
			const s = await rest.getJson(`/api/connections/${mediaConnectionId}/status`)
			return s.status?.category === 'good' ? s : null
		},
		{ label: 'media connection status good' }
	)
	record('media connection status is good', true, JSON.stringify(mediaStatus.status))

	const mangohudStatus = await waitFor(
		async () => {
			const s = await rest.getJson(`/api/connections/${mangohudConnectionId}/status`)
			return s.status?.category === 'good' ? s : null
		},
		{ label: 'mangohud connection status good' }
	)
	record('mangohud connection status is good', true, JSON.stringify(mangohudStatus.status))

	// === runtime command lines (with --permission flags) from Companion's own debug log ===
	const mediaCmdLine = companion.logLines.find((l) => l.includes('Instance "media" command:'))
	const mangohudCmdLine = companion.logLines.find((l) => l.includes('Instance "mangohud" command:'))
	record(
		'media runtime command line uses --permission with no fs grant',
		!!mediaCmdLine && mediaCmdLine.includes('--permission') && !mediaCmdLine.includes("'--allow-fs-write=*'"),
		mediaCmdLine ?? 'not found in log'
	)
	record(
		'mangohud runtime command line uses --permission with --allow-fs-write=*',
		!!mangohudCmdLine && mangohudCmdLine.includes('--allow-fs-write=*'),
		mangohudCmdLine ?? 'not found in log'
	)
	const accessDeniedLines = companion.logLines.filter((l) => l.includes('ERR_ACCESS_DENIED'))
	record('no ERR_ACCESS_DENIED in the module logs', accessDeniedLines.length === 0, accessDeniedLines.join(' | '))

	// === linux-media variables match the fake player ===
	const title = await rest.getText('/api/variable/media/title/value')
	const artist = await rest.getText('/api/variable/media/artist/value')
	record('title variable matches fake player', title.text === 'Smoke Song', title.text)
	record('artist variable matches fake player', artist.text === 'Smoke Artist', artist.text)

	// === build a button with the playpause action, press it via REST, confirm it reached the fake player ===
	const mediaControlId = await buttonAt(1, 0, 0)
	record('created button for media playpause action', !!mediaControlId, mediaControlId)
	await addAction(mediaControlId, mediaConnectionId, 'playpause')

	const callsBefore = fakePlayer.interface.playPauseCalls
	await rest.post('/api/location/1/0/0/press')
	await waitFor(() => fakePlayer.interface.playPauseCalls > callsBefore, {
		label: 'fake player PlayPause call',
		timeoutMs: 5000,
	})
	record(
		'playpause action reached the fake player over D-Bus',
		fakePlayer.interface.playPauseCalls > callsBefore,
		`playPauseCalls=${fakePlayer.interface.playPauseCalls}`
	)

	// === a feedback referencing the same connection, for the format finding ===
	await mutate(trpc, 'controls.entities.add', {
		controlId: mediaControlId,
		entityLocation: 'feedbacks',
		ownerId: null,
		connectionId: mediaConnectionId,
		entityType: 'feedback',
		entityDefinition: 'playing',
	})
	record('added a feedback referencing the media connection', true)

	// === player disappearing/appearing flips variables ===
	await fakePlayer.disconnect()
	await waitFor(async () => (await rest.getText('/api/variable/media/status/value')).text === 'Stopped', {
		label: 'status -> Stopped after player vanished',
	})
	record('status variable flips to Stopped when the player vanishes', true)

	fakePlayer = await makeFakePlayer({ title: 'Second Song', artist: ['Second Artist'] })
	await waitFor(async () => (await rest.getText('/api/variable/media/title/value')).text === 'Second Song', {
		label: 'title -> Second Song after player reappeared',
	})
	record('title variable picks up a reappearing player', true)

	// === mangohud: set preset action rewrites the config files, preset variable follows ===
	const presetControlId = await buttonAt(1, 0, 1)
	const setPresetEntityId = await addAction(presetControlId, mangohudConnectionId, 'set_preset')
	await mutate(trpc, 'controls.entities.setOption', {
		controlId: presetControlId,
		entityLocation: { stepId: '0', setId: 'down' },
		entityId: setPresetEntityId,
		key: 'preset',
		value: { value: 1, isExpression: false },
	})

	await rest.post('/api/location/1/0/1/press')
	await waitFor(async () => (await rest.getText('/api/variable/mangohud/preset/value')).text === '1', {
		label: 'preset variable -> 1',
	})
	const presetValue = await rest.getText('/api/variable/mangohud/preset/value')
	record('preset variable follows the set_preset action', presetValue.text === '1', presetValue.text)

	const mainConfAfter = fs.readFileSync(path.join(mangohudConfigDir, 'MangoHud.conf'), 'utf8')
	const gameConfAfter = fs.readFileSync(path.join(mangohudConfigDir, 'game.conf'), 'utf8')
	record('MangoHud.conf preset= line rewritten to 1,2,0', /^preset=1,2,0$/m.test(mainConfAfter), mainConfAfter.trim())
	record(
		'per-app game.conf preset= line also rewritten',
		/^preset=1,2,0$/m.test(gameConfAfter),
		gameConfAfter.trim()
	)

	// === toggle HUD action hits the fake control socket with the exact bytes ===
	const hudControlId = await buttonAt(1, 0, 2)
	await addAction(hudControlId, mangohudConnectionId, 'toggle_hud')

	const socketCallsBefore = fakeSocket.received.length
	await rest.post('/api/location/1/0/2/press')
	await waitFor(() => fakeSocket.received.length > socketCallsBefore, {
		label: 'fake control socket received bytes',
	})
	record(
		'toggle_hud sent the exact ":hud;" bytes to the control socket',
		fakeSocket.received[fakeSocket.received.length - 1] === ':hud;',
		JSON.stringify(fakeSocket.received)
	)

	// === gamemode: fake D-Bus service flips the gamemode variable ===
	fakeGamemode.interface.setClientCount(1)
	await waitFor(async () => (await rest.getText('/api/variable/mangohud/gamemode/value')).text === 'on', {
		label: 'gamemode variable -> on',
	})
	record('gamemode variable flips on via the fake GameMode service', true)

	fakeGamemode.interface.setClientCount(0)
	await waitFor(async () => (await rest.getText('/api/variable/mangohud/gamemode/value')).text === 'off', {
		label: 'gamemode variable -> off',
	})
	record('gamemode variable flips off via the fake GameMode service', true)

	// === sensors: fake sysfs is not possible in a real run, but a missing sensor must still read
	// "-" (200), not come back 404/unset - regression check for the init()-ordering bug fixed in
	// fix(mangohud): declare variables before the first applyConfig() push (see smoke report) ===
	await waitFor(async () => (await rest.getText('/api/variable/mangohud/cpu_temp/value')).text === '-', {
		label: 'cpu_temp variable -> "-" (no AMD hwmon on this host)',
	})
	const cpuTemp = await rest.getText('/api/variable/mangohud/cpu_temp/value')
	const gpuTemp = await rest.getText('/api/variable/mangohud/gpu_temp/value')
	const gpuLoad = await rest.getText('/api/variable/mangohud/gpu_load/value')
	const gsRunning = await rest.getText('/api/variable/mangohud/gs_running/value')
	record(
		'sensor variables read "-" (not 404/unset) with no AMD hwmon on this host',
		cpuTemp.status === 200 &&
			cpuTemp.text === '-' &&
			gpuTemp.status === 200 &&
			gpuTemp.text === '-' &&
			gpuLoad.status === 200 &&
			gpuLoad.text === '-',
		`cpu_temp=${cpuTemp.status}:${cpuTemp.text} gpu_temp=${gpuTemp.status}:${gpuTemp.text} gpu_load=${gpuLoad.status}:${gpuLoad.text}`
	)
	record(
		'gamescope variable reads "off" (not 404/unset) with no gamescope process running',
		gsRunning.status === 200 && gsRunning.text === 'off',
		`gs_running=${gsRunning.status}:${gsRunning.text}`
	)

	// === format finding: export the full config, with the two connections and the button above ===
	// Export/import live under /int (an internal-only, DNS-rebinding-guarded prefix - see
	// companion/lib/UI/Express.ts), not under the public /api used for connections/variables/press.
	const exportRes = await fetch(`${companion.url}/int/export/full?format=json`)
	const exportText = await exportRes.text()
	const exportPath = path.join(REPO_ROOT, 'docs/notes/companion-export-sample.json')
	fs.writeFileSync(exportPath, exportText)
	record('exported full config as JSON', exportRes.ok && exportText.length > 0, `${exportText.length} bytes -> ${exportPath}`)

	const exportJson = JSON.parse(exportText)
	fs.writeFileSync(
		path.join(REPO_ROOT, 'docs/notes/companion-connections-sample.json'),
		JSON.stringify(exportJson.instances, null, 2)
	)
} catch (err) {
	record(err?.name === 'Error' && err.message ? `crashed: ${err.message}` : 'crashed', false, err?.stack ?? String(err))
} finally {
	console.log('--- tearing down fakes and Companion ---')
	for (const player of fakePlayerFixtures) {
		await player.disconnect().catch(() => {})
	}
	await fakeGamemode.disconnect().catch(() => {})
	await fakeSocket.close().catch(() => {})
	closeTrpc()
	await companion.stop()
}

const resultsPath = process.env.COMPANION_SMOKE_RESULTS_FILE
if (resultsPath) fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
	console.log('Failed checks:')
	for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
	process.exitCode = 1
}

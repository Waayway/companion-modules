import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'

/**
 * Companion runs modules as `node --permission --allow-net --allow-fs-read=<module dir>`, and
 * additionally grants `--allow-fs-read=* --allow-fs-write=*` when the manifest declares the
 * `filesystem` runtime permission (companion/manifest.json for this module). This proves that
 * claim end to end: the preset config file operations this module needs (read/write/watch a
 * directory outside the module's own folder) are denied without the permission and allowed with
 * it, while the control socket (net only) works in both cases, justifying why only `filesystem`
 * is requested.
 */
const PROBE_SCRIPT = `
import fs from 'node:fs'
import net from 'node:net'

const targetDir = process.argv[2]
const socketName = process.argv[3]
const results = {}

try {
	fs.readFileSync(targetDir + '/MangoHud.conf', 'utf8')
	results.read = 'ALLOWED'
} catch (err) {
	results.read = err.code
}

try {
	fs.writeFileSync(targetDir + '/probe.tmp', 'x')
	fs.rmSync(targetDir + '/probe.tmp')
	results.write = 'ALLOWED'
} catch (err) {
	results.write = err.code
}

try {
	const watcher = fs.watch(targetDir)
	watcher.close()
	results.watch = 'ALLOWED'
} catch (err) {
	results.watch = err.code
}

await new Promise((resolve) => {
	const socket = net.connect('\\0' + socketName)
	socket.once('connect', () => {
		results.net = 'ALLOWED'
		socket.end()
		resolve()
	})
	socket.once('error', (err) => {
		results.net = err.code
		resolve()
	})
})

console.log(JSON.stringify(results))
process.exit(0)
`

test('filesystem permission gates config file access; network access is unaffected', async (t) => {
	const moduleDirStandIn = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-mangohud-permmod-'))
	const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-mangohud-permtarget-'))
	fs.writeFileSync(path.join(targetDir, 'MangoHud.conf'), 'preset=0,1,2\n')
	const probePath = path.join(moduleDirStandIn, 'probe.mjs')
	fs.writeFileSync(probePath, PROBE_SCRIPT)

	const socketName = `cm-mangohud-permtest-${process.pid}`
	const server = net.createServer((socket) => socket.end()).listen('\0' + socketName)
	t.after(() => {
		server.close()
		fs.rmSync(moduleDirStandIn, { recursive: true, force: true })
		fs.rmSync(targetDir, { recursive: true, force: true })
	})
	await new Promise((resolve) => server.once('listening', resolve))

	const withoutPermission = spawnSync(
		process.execPath,
		['--permission', '--allow-net', `--allow-fs-read=${moduleDirStandIn}`, probePath, targetDir, socketName],
		{ encoding: 'utf8' },
	)
	assert.equal(withoutPermission.status, 0, withoutPermission.stderr)
	const withoutResult = JSON.parse(withoutPermission.stdout.trim())
	assert.equal(withoutResult.read, 'ERR_ACCESS_DENIED')
	assert.equal(withoutResult.write, 'ERR_ACCESS_DENIED')
	assert.equal(withoutResult.watch, 'ERR_ACCESS_DENIED')
	assert.equal(withoutResult.net, 'ALLOWED')

	const withPermission = spawnSync(
		process.execPath,
		['--permission', '--allow-net', '--allow-fs-read=*', '--allow-fs-write=*', probePath, targetDir, socketName],
		{ encoding: 'utf8' },
	)
	assert.equal(withPermission.status, 0, withPermission.stderr)
	const withResult = JSON.parse(withPermission.stdout.trim())
	assert.equal(withResult.read, 'ALLOWED')
	assert.equal(withResult.write, 'ALLOWED')
	assert.equal(withResult.watch, 'ALLOWED')
	assert.equal(withResult.net, 'ALLOWED')
})

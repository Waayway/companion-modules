import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { pickRefresh, readHyprlandRefresh } from './hyprland.js'

const MONITORS = [
	{ name: 'DP-3', refreshRate: 143.981, focused: false },
	{ name: 'HDMI-A-1', refreshRate: 59.94, focused: true },
]

test('pickRefresh prefers the first listed output Hyprland has, rounded', () => {
	assert.equal(pickRefresh(MONITORS, ['DP-9', 'DP-3']), 144)
})

test('pickRefresh falls back to the focused monitor', () => {
	assert.equal(pickRefresh(MONITORS, []), 60)
	assert.equal(pickRefresh(MONITORS, ['DP-9']), 60)
})

test('pickRefresh returns null with no monitors', () => {
	assert.equal(pickRefresh([], ['DP-3']), null)
})

test('readHyprlandRefresh asks a fake Hyprland socket for j/monitors', async (t) => {
	const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-hypr-test-'))
	t.after(() => fs.rmSync(runtimeDir, { recursive: true, force: true }))
	const instanceDir = path.join(runtimeDir, 'hypr', 'abc_1_2')
	fs.mkdirSync(instanceDir, { recursive: true })
	const requests: string[] = []
	const server = net.createServer((conn) => {
		conn.on('data', (data) => {
			requests.push(data.toString())
			conn.end(JSON.stringify(MONITORS))
		})
	})
	await new Promise<void>((resolve) => server.listen(path.join(instanceDir, '.socket.sock'), resolve))
	t.after(() => server.close())

	assert.equal(await readHyprlandRefresh(['DP-3'], runtimeDir), 144)
	assert.deepEqual(requests, ['j/monitors'])
})

test('readHyprlandRefresh returns null without a Hyprland runtime dir', async () => {
	assert.equal(await readHyprlandRefresh(['DP-3'], '/nonexistent'), null)
})

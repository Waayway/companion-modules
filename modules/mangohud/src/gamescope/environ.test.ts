import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findGameProcessInsideGamescope } from './environ.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-gs-environ-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

function writeProc(
	procRoot: string,
	pid: number,
	options: { environ?: Record<string, string> | null; cmdline?: string[] | null },
): void {
	const dir = path.join(procRoot, String(pid))
	fs.mkdirSync(dir, { recursive: true })
	if (options.environ !== null && options.environ !== undefined) {
		const raw =
			Object.entries(options.environ)
				.map(([key, value]) => `${key}=${value}`)
				.join('\0') + '\0'
		fs.writeFileSync(path.join(dir, 'environ'), raw)
	}
	if (options.cmdline !== null && options.cmdline !== undefined) {
		fs.writeFileSync(path.join(dir, 'cmdline'), options.cmdline.join('\0') + '\0')
	}
}

test('returns null when no process has GAMESCOPE_WAYLAND_DISPLAY', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, { environ: { HOME: '/home/x' }, cmdline: ['bash'] })

	assert.equal(findGameProcessInsideGamescope(root), null)
})

test('falls back to the only match when nothing looks like a game', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, {
		environ: { GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0', DISPLAY: ':1', ENABLE_GAMESCOPE_WSI: '0' },
		cmdline: ['some-launcher'],
	})

	const found = findGameProcessInsideGamescope(root)
	assert.ok(found)
	assert.equal(found.pid, 10)
	assert.equal(found.display, ':1')
	assert.equal(found.wsiEnabled, false)
})

test('prefers a wine/.exe process over another match, regardless of pid order', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, {
		environ: { GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0', DISPLAY: ':1' },
		cmdline: ['steam-overlay-helper'],
	})
	writeProc(root, 20, {
		environ: { GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0', DISPLAY: ':1', XAUTHORITY: '/run/user/1000/.xauth' },
		cmdline: ['/game/wine', 'MyGame.exe'],
	})

	const found = findGameProcessInsideGamescope(root)
	assert.ok(found)
	assert.equal(found.pid, 20)
	assert.equal(found.xauthority, '/run/user/1000/.xauth')
})

test('matches case-insensitively on ".exe" or "wine" in the cmdline', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, {
		environ: { GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0' },
		cmdline: ['/compat/WINE/bin/wine64', 'Game.EXE'],
	})

	const found = findGameProcessInsideGamescope(root)
	assert.equal(found?.pid, 10)
})

test('skips a process whose environ cannot be read and keeps scanning', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, { environ: null, cmdline: ['secret'] }) // environ unreadable
	writeProc(root, 20, { environ: { GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0', DISPLAY: ':2' }, cmdline: ['game'] })

	const found = findGameProcessInsideGamescope(root)
	assert.equal(found?.pid, 20)
	assert.equal(found?.display, ':2')
})

test('display and xauthority default to null when absent from the environ', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, { environ: { GAMESCOPE_WAYLAND_DISPLAY: 'gamescope-0' }, cmdline: ['game'] })

	const found = findGameProcessInsideGamescope(root)
	assert.equal(found?.display, null)
	assert.equal(found?.xauthority, null)
	assert.equal(found?.wsiEnabled, true)
})

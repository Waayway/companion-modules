import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findGamescopeProcess } from './process.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-gs-process-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

function writeProc(procRoot: string, pid: number, comm: string | null, cmdline: string[] | null): string {
	const dir = path.join(procRoot, String(pid))
	fs.mkdirSync(dir, { recursive: true })
	if (comm !== null) fs.writeFileSync(path.join(dir, 'comm'), `${comm}\n`)
	if (cmdline !== null) fs.writeFileSync(path.join(dir, 'cmdline'), cmdline.join('\0') + '\0')
	return dir
}

function ownUid(): number {
	return process.getuid?.() ?? 0
}

test('finds the lowest-pid process named gamescope owned by the given uid', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 50, 'gamescope', ['gamescope', '-W', '1920', '-H', '1080'])
	writeProc(root, 99, 'gamescope', ['gamescope', '-W', '2560', '-H', '1440'])

	const found = findGamescopeProcess(root, ownUid())
	assert.ok(found)
	assert.equal(found.pid, 50)
	assert.equal(found.flags.width, 1920)
})

test('recognises gamescope-wl as well as gamescope', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, 'gamescope-wl', ['gamescope-wl', '--hdr-enabled'])

	const found = findGamescopeProcess(root, ownUid())
	assert.ok(found)
	assert.equal(found.flags.hdrRequested, true)
})

test('skips a process with a matching name owned by a different uid', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, 'gamescope', ['gamescope'])

	assert.equal(findGamescopeProcess(root, ownUid() + 1), null)
})

test('skips a candidate whose cmdline cannot be read and keeps scanning', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, 'gamescope', null) // comm matches, cmdline unreadable
	writeProc(root, 20, 'gamescope', ['gamescope', '-W', '1280'])

	const found = findGamescopeProcess(root, ownUid())
	assert.ok(found)
	assert.equal(found.pid, 20)
})

test('returns null when no process has a matching comm', (t) => {
	const root = makeTempDir(t)
	writeProc(root, 10, 'steam', ['steam'])

	assert.equal(findGamescopeProcess(root, ownUid()), null)
})

test('returns null when procRoot itself does not exist', () => {
	assert.equal(findGamescopeProcess('/does/not/exist', ownUid()), null)
})

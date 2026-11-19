import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { listPids, parseEnviron, readProcFileIfReadable, splitNulSeparated, statOwnerUid } from './procfs.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-procfs-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

test('listPids returns only numeric entries, sorted ascending', (t) => {
	const root = makeTempDir(t)
	fs.mkdirSync(path.join(root, '42'))
	fs.mkdirSync(path.join(root, '7'))
	fs.mkdirSync(path.join(root, 'self'))
	fs.writeFileSync(path.join(root, 'version'), 'x')

	assert.deepEqual(listPids(root), [7, 42])
})

test('listPids returns an empty array when the root is missing', () => {
	assert.deepEqual(listPids('/does/not/exist'), [])
})

test('readProcFileIfReadable returns null for a missing file instead of throwing', (t) => {
	const root = makeTempDir(t)
	assert.equal(readProcFileIfReadable(path.join(root, 'comm')), null)
})

test('readProcFileIfReadable returns the file contents when present', (t) => {
	const root = makeTempDir(t)
	fs.writeFileSync(path.join(root, 'comm'), 'gamescope\n')
	assert.equal(readProcFileIfReadable(path.join(root, 'comm')), 'gamescope\n')
})

test('statOwnerUid returns null for a missing path instead of throwing', () => {
	assert.equal(statOwnerUid('/does/not/exist'), null)
})

test('statOwnerUid returns the owning uid for a path that exists', (t) => {
	const root = makeTempDir(t)
	assert.equal(statOwnerUid(root), fs.statSync(root).uid)
})

test('splitNulSeparated drops empty trailing/leading fields', () => {
	assert.deepEqual(splitNulSeparated('a\0b\0c\0'), ['a', 'b', 'c'])
	assert.deepEqual(splitNulSeparated(''), [])
})

test('parseEnviron splits NUL separated KEY=VALUE entries and ignores entries without "="', () => {
	assert.deepEqual(parseEnviron('DISPLAY=:1\0ENABLE_GAMESCOPE_WSI=0\0GARBAGE\0'), {
		DISPLAY: ':1',
		ENABLE_GAMESCOPE_WSI: '0',
	})
})

test('parseEnviron keeps everything after the first "=" (values may contain one)', () => {
	assert.deepEqual(parseEnviron('XAUTHORITY=/run/user/1000/.mutter-Xwaylandauth.ABC=DEF\0'), {
		XAUTHORITY: '/run/user/1000/.mutter-Xwaylandauth.ABC=DEF',
	})
})

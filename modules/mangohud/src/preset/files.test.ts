import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyPresetToDir, atomicWriteFile, readActivePresetEntries } from './files.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-files-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

test('applyPresetToDir edits an existing preset= line in MangoHud.conf', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'fps=1\npreset=0,1,2\n')

	applyPresetToDir(dir, [1, 2, 0], false)

	assert.equal(fs.readFileSync(path.join(dir, 'MangoHud.conf'), 'utf8'), 'fps=1\npreset=1,2,0\n')
})

test('applyPresetToDir prepends a preset= line when MangoHud.conf has none', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'fps=1\n')

	applyPresetToDir(dir, [2, 1, 0], false)

	assert.equal(fs.readFileSync(path.join(dir, 'MangoHud.conf'), 'utf8'), 'preset=2,1,0\nfps=1\n')
})

test('applyPresetToDir creates MangoHud.conf when the file is missing', (t) => {
	const dir = makeTempDir(t)
	assert.equal(readActivePresetEntries(dir), null)

	applyPresetToDir(dir, [0, 1, 2], false)

	assert.equal(fs.readFileSync(path.join(dir, 'MangoHud.conf'), 'utf8'), 'preset=0,1,2\n')
	assert.deepEqual(readActivePresetEntries(dir), [0, 1, 2])
})

test('applyPresetToDir with updatePerAppConfigs updates only per-app files that already have a preset= line, and never presets.conf', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=0,1,2\n')
	fs.writeFileSync(path.join(dir, 'game.conf'), 'fps=1\npreset=0,1,2\n')
	fs.writeFileSync(path.join(dir, 'wine-other.conf'), 'fps=1\n') // no preset= line: must stay untouched
	fs.writeFileSync(path.join(dir, 'presets.conf'), 'preset=0,1,2\n') // must never be touched

	const result = applyPresetToDir(dir, [2, 0, 1], true)

	assert.equal(fs.readFileSync(path.join(dir, 'MangoHud.conf'), 'utf8'), 'preset=2,0,1\n')
	assert.equal(fs.readFileSync(path.join(dir, 'game.conf'), 'utf8'), 'fps=1\npreset=2,0,1\n')
	assert.equal(fs.readFileSync(path.join(dir, 'wine-other.conf'), 'utf8'), 'fps=1\n')
	assert.equal(fs.readFileSync(path.join(dir, 'presets.conf'), 'utf8'), 'preset=0,1,2\n')
	assert.deepEqual(result.updatedFiles.map((p) => path.basename(p)).sort(), ['MangoHud.conf', 'game.conf'])
})

test('applyPresetToDir without updatePerAppConfigs leaves other files untouched', (t) => {
	const dir = makeTempDir(t)
	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=0,1,2\n')
	fs.writeFileSync(path.join(dir, 'game.conf'), 'preset=0,1,2\n')

	applyPresetToDir(dir, [1, 0, 2], false)

	assert.equal(fs.readFileSync(path.join(dir, 'game.conf'), 'utf8'), 'preset=0,1,2\n')
})

test('applyPresetToDir creates the config dir when it does not exist yet', (t) => {
	const parent = makeTempDir(t)
	const dir = path.join(parent, 'nested', 'MangoHud')
	assert.equal(fs.existsSync(dir), false)

	applyPresetToDir(dir, [0, 1, 2], false)

	assert.equal(fs.readFileSync(path.join(dir, 'MangoHud.conf'), 'utf8'), 'preset=0,1,2\n')
})

test('applyPresetToDir writes through a symlinked MangoHud.conf, keeping the link in place', (t) => {
	const dir = makeTempDir(t)
	const realDir = makeTempDir(t)
	const realPath = path.join(realDir, 'real-MangoHud.conf')
	fs.writeFileSync(realPath, 'fps=1\npreset=0,1,2\n')
	const linkPath = path.join(dir, 'MangoHud.conf')
	fs.symlinkSync(realPath, linkPath)

	applyPresetToDir(dir, [2, 0, 1], false)

	assert.equal(fs.readlinkSync(linkPath), realPath)
	assert.equal(fs.readFileSync(realPath, 'utf8'), 'fps=1\npreset=2,0,1\n')
	assert.equal(fs.readFileSync(linkPath, 'utf8'), 'fps=1\npreset=2,0,1\n')
	assert.deepEqual(
		fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')),
		[],
	)
})

test('atomicWriteFile never leaves a .tmp file behind', (t) => {
	const dir = makeTempDir(t)
	const target = path.join(dir, 'MangoHud.conf')

	atomicWriteFile(target, 'preset=0,1,2\n')

	const leftovers = fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'))
	assert.deepEqual(leftovers, [])
	assert.equal(fs.readFileSync(target, 'utf8'), 'preset=0,1,2\n')
})

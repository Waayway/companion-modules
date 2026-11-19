import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findHwmonDirByName, readTemp1InputCelsius } from './hwmon.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-hwmon-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

function writeHwmon(sysfsRoot: string, id: string, name: string, temp1Input?: number): string {
	const dir = path.join(sysfsRoot, 'class', 'hwmon', id)
	fs.mkdirSync(dir, { recursive: true })
	fs.writeFileSync(path.join(dir, 'name'), `${name}\n`)
	if (temp1Input !== undefined) fs.writeFileSync(path.join(dir, 'temp1_input'), `${temp1Input}\n`)
	return dir
}

test('findHwmonDirByName finds the entry whose name file matches', (t) => {
	const root = makeTempDir(t)
	writeHwmon(root, 'hwmon0', 'nvme', 30000)
	const k10 = writeHwmon(root, 'hwmon1', 'k10temp', 45000)

	assert.equal(findHwmonDirByName(root, ['k10temp', 'zenpower']), k10)
})

test('findHwmonDirByName skips a first entry with the wrong name and finds the second', (t) => {
	const root = makeTempDir(t)
	writeHwmon(root, 'hwmon0', 'iwlwifi_1', 0)
	const amdgpu = writeHwmon(root, 'hwmon1', 'amdgpu', 52000)

	assert.equal(findHwmonDirByName(root, ['amdgpu']), amdgpu)
})

test('findHwmonDirByName returns null when no entry matches', (t) => {
	const root = makeTempDir(t)
	writeHwmon(root, 'hwmon0', 'nvme', 30000)

	assert.equal(findHwmonDirByName(root, ['k10temp', 'zenpower']), null)
})

test('findHwmonDirByName returns null when the hwmon class dir is missing entirely', (t) => {
	const root = makeTempDir(t)

	assert.equal(findHwmonDirByName(root, ['k10temp']), null)
})

test('readTemp1InputCelsius rounds millidegrees to the nearest whole degree', (t) => {
	const root = makeTempDir(t)
	const dir = writeHwmon(root, 'hwmon0', 'k10temp', 45678)

	assert.equal(readTemp1InputCelsius(dir), 46)
})

test('readTemp1InputCelsius returns null when temp1_input is missing', (t) => {
	const root = makeTempDir(t)
	const dir = writeHwmon(root, 'hwmon0', 'k10temp')

	assert.equal(readTemp1InputCelsius(dir), null)
})

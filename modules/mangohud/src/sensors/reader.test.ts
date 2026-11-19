import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readSensors } from './reader.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-reader-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

function writeHwmon(sysfsRoot: string, id: string, name: string, temp1Input?: number): void {
	const dir = path.join(sysfsRoot, 'class', 'hwmon', id)
	fs.mkdirSync(dir, { recursive: true })
	fs.writeFileSync(path.join(dir, 'name'), `${name}\n`)
	if (temp1Input !== undefined) fs.writeFileSync(path.join(dir, 'temp1_input'), `${temp1Input}\n`)
}

function writeCard(sysfsRoot: string, cardName: string, busyPercent: number): void {
	const dir = path.join(sysfsRoot, 'class', 'drm', cardName, 'device')
	fs.mkdirSync(dir, { recursive: true })
	fs.writeFileSync(path.join(dir, 'gpu_busy_percent'), `${busyPercent}\n`)
}

test('readSensors combines cpu temp, gpu temp and gpu load from a realistic fake sysfs tree', (t) => {
	const root = makeTempDir(t)
	writeHwmon(root, 'hwmon0', 'nvme', 30000)
	writeHwmon(root, 'hwmon1', 'k10temp', 45000)
	writeHwmon(root, 'hwmon2', 'amdgpu', 52000)
	writeCard(root, 'card0', 12)

	assert.deepEqual(readSensors(root), { cpuTemp: 45, gpuTemp: 52, gpuLoad: 12 })
})

test('readSensors returns null for every sensor that cannot be found', (t) => {
	const root = makeTempDir(t)

	assert.deepEqual(readSensors(root), { cpuTemp: null, gpuTemp: null, gpuLoad: null })
})

test('readSensors finds zenpower as an alternative CPU sensor', (t) => {
	const root = makeTempDir(t)
	writeHwmon(root, 'hwmon0', 'zenpower', 38500)

	assert.deepEqual(readSensors(root), { cpuTemp: 39, gpuTemp: null, gpuLoad: null })
})

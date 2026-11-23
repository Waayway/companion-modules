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

test('readSensors reads load and temp from the discrete GPU, not the iGPU at card0', (t) => {
	const root = makeTempDir(t)
	writeHwmon(root, 'hwmon1', 'k10temp', 60000)
	// iGPU: card0, first amdgpu hwmon, small VRAM
	writeHwmon(root, 'hwmon2', 'amdgpu', 40000)
	writeCard(root, 'card0', 0)
	fs.writeFileSync(path.join(root, 'class', 'drm', 'card0', 'device', 'mem_info_vram_total'), '536870912\n')
	// discrete: card1, 16 GiB, its own hwmon under device/hwmon
	writeCard(root, 'card1', 97)
	fs.writeFileSync(path.join(root, 'class', 'drm', 'card1', 'device', 'mem_info_vram_total'), '17179869184\n')
	const hwmon = path.join(root, 'class', 'drm', 'card1', 'device', 'hwmon', 'hwmon3')
	fs.mkdirSync(hwmon, { recursive: true })
	fs.writeFileSync(path.join(hwmon, 'temp1_input'), '71000\n')

	assert.deepEqual(readSensors(root), { cpuTemp: 60, gpuTemp: 71, gpuLoad: 97 })
})

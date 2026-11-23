import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findGpuBusyPercentPath, findGpuHwmonDir, readGpuBusyPercent } from './gpu.js'

function makeTempDir(t: import('node:test').TestContext): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-gpu-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
	return dir
}

function writeCard(sysfsRoot: string, cardName: string, busyPercent?: number): string {
	const dir = path.join(sysfsRoot, 'class', 'drm', cardName, 'device')
	fs.mkdirSync(dir, { recursive: true })
	const busyPath = path.join(dir, 'gpu_busy_percent')
	if (busyPercent !== undefined) fs.writeFileSync(busyPath, `${busyPercent}\n`)
	return busyPath
}

test('findGpuBusyPercentPath finds the first card exposing the file, skipping connector subdirs', (t) => {
	const root = makeTempDir(t)
	fs.mkdirSync(path.join(root, 'class', 'drm', 'card0-DP-1'), { recursive: true })
	const busyPath = writeCard(root, 'card0', 37)

	assert.equal(findGpuBusyPercentPath(root), busyPath)
})

test('findGpuBusyPercentPath returns null when no card exposes the file', (t) => {
	const root = makeTempDir(t)
	fs.mkdirSync(path.join(root, 'class', 'drm', 'card0', 'device'), { recursive: true })

	assert.equal(findGpuBusyPercentPath(root), null)
})

test('findGpuBusyPercentPath returns null when the drm class dir is missing entirely', (t) => {
	const root = makeTempDir(t)

	assert.equal(findGpuBusyPercentPath(root), null)
})

test('readGpuBusyPercent parses the integer percentage', (t) => {
	const root = makeTempDir(t)
	writeCard(root, 'card0', 73)

	assert.equal(readGpuBusyPercent(root), 73)
})

test('readGpuBusyPercent returns null when no card exposes the file', (t) => {
	const root = makeTempDir(t)

	assert.equal(readGpuBusyPercent(root), null)
})

function writeVram(sysfsRoot: string, cardName: string, bytes: number): void {
	fs.writeFileSync(path.join(sysfsRoot, 'class', 'drm', cardName, 'device', 'mem_info_vram_total'), `${bytes}\n`)
}

test('findGpuBusyPercentPath picks the discrete card (most VRAM) over an iGPU at card0', (t) => {
	const root = makeTempDir(t)
	writeCard(root, 'card0', 0)
	writeVram(root, 'card0', 512 * 1024 ** 2)
	const discrete = writeCard(root, 'card1', 98)
	writeVram(root, 'card1', 16 * 1024 ** 3)

	assert.equal(findGpuBusyPercentPath(root), discrete)
	assert.equal(readGpuBusyPercent(root), 98)
})

test('findGpuBusyPercentPath sorts cards numerically (card10 after card2)', (t) => {
	const root = makeTempDir(t)
	const card2 = writeCard(root, 'card2', 5)
	writeCard(root, 'card10', 6)

	assert.equal(findGpuBusyPercentPath(root), card2)
})

test('findGpuHwmonDir returns the chosen card own hwmon dir', (t) => {
	const root = makeTempDir(t)
	writeCard(root, 'card0', 0)
	writeVram(root, 'card0', 512 * 1024 ** 2)
	writeCard(root, 'card1', 50)
	writeVram(root, 'card1', 16 * 1024 ** 3)
	const hwmon = path.join(root, 'class', 'drm', 'card1', 'device', 'hwmon', 'hwmon3')
	fs.mkdirSync(hwmon, { recursive: true })

	assert.equal(findGpuHwmonDir(root), hwmon)
})

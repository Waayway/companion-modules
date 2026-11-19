import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findGpuBusyPercentPath, readGpuBusyPercent } from './gpu.js'

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

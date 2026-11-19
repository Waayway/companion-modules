import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { watchConfigDir } from './watch.js'

test('watchConfigDir refreshes after an external edit, debounced', async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-watch-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

	let calls = 0
	const stop = watchConfigDir(
		dir,
		() => {
			calls++
		},
		50,
	)
	t.after(stop)

	fs.writeFileSync(path.join(dir, 'MangoHud.conf'), 'preset=0,1,2\n')

	await new Promise((resolve) => setTimeout(resolve, 300))

	assert.ok(calls >= 1, `expected at least one callback, got ${calls}`)
})

test('watchConfigDir debounces rapid successive changes into one callback', async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mangohud-watch-test-'))
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

	let calls = 0
	const stop = watchConfigDir(
		dir,
		() => {
			calls++
		},
		100,
	)
	t.after(stop)

	const target = path.join(dir, 'MangoHud.conf')
	fs.writeFileSync(target, 'preset=0\n')
	fs.writeFileSync(target, 'preset=1\n')
	fs.writeFileSync(target, 'preset=2\n')

	await new Promise((resolve) => setTimeout(resolve, 300))

	assert.equal(calls, 1)
})

test('watchConfigDir on a missing directory does not throw, and close() is a no-op', () => {
	const missing = path.join(os.tmpdir(), 'mangohud-watch-test-missing-' + process.pid)
	assert.doesNotThrow(() => {
		const stop = watchConfigDir(missing, () => {
			throw new Error('should never be called')
		})
		stop()
	})
})

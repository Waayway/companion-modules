import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createReachabilityChecker } from './reachable.js'

test('createReachabilityChecker caches a successful probe', async () => {
	let calls = 0
	const checkReachable = createReachabilityChecker(async () => {
		calls++
		return { handshake: 'ok' }
	}, 1000)

	assert.equal(await checkReachable('mangohud'), true)
	assert.equal(await checkReachable('mangohud'), true)
	assert.equal(calls, 1)
})

test('createReachabilityChecker caches a failed probe as false', async () => {
	let calls = 0
	const checkReachable = createReachabilityChecker(async () => {
		calls++
		throw new Error('ECONNREFUSED')
	}, 1000)

	assert.equal(await checkReachable('mangohud'), false)
	assert.equal(await checkReachable('mangohud'), false)
	assert.equal(calls, 1)
})

test('createReachabilityChecker re-probes once the cache expires', async () => {
	let calls = 0
	const checkReachable = createReachabilityChecker(async () => {
		calls++
		return { handshake: 'ok' }
	}, 20)

	await checkReachable('mangohud')
	await new Promise((resolve) => setTimeout(resolve, 60))
	await checkReachable('mangohud')

	assert.equal(calls, 2)
})

test('createReachabilityChecker de-duplicates concurrent calls into a single probe', async () => {
	let calls = 0
	const checkReachable = createReachabilityChecker(async () => {
		calls++
		await new Promise((resolve) => setTimeout(resolve, 20))
		return { handshake: 'ok' }
	}, 1000)

	const [a, b] = await Promise.all([checkReachable('mangohud'), checkReachable('mangohud')])
	assert.equal(a, true)
	assert.equal(b, true)
	assert.equal(calls, 1)
})

test('createReachabilityChecker keeps separate cache entries per socket name', async () => {
	let calls = 0
	const checkReachable = createReachabilityChecker(async (socketName) => {
		calls++
		if (socketName === 'bad') throw new Error('nope')
		return { handshake: 'ok' }
	}, 1000)

	assert.equal(await checkReachable('good'), true)
	assert.equal(await checkReachable('bad'), false)
	assert.equal(calls, 2)
})

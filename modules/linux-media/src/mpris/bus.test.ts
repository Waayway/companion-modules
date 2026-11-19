import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeBackoffMs, resolveBusAddress } from './bus.js'

void test('resolveBusAddress prefers the configured override', () => {
	assert.equal(resolveBusAddress('unix:path=/custom/bus', '/run/user/1000'), 'unix:path=/custom/bus')
})

void test('resolveBusAddress trims whitespace before deciding the override is empty', () => {
	assert.equal(resolveBusAddress('   ', '/run/user/1000'), 'unix:path=/run/user/1000/bus')
})

void test('resolveBusAddress falls back to $XDG_RUNTIME_DIR/bus', () => {
	assert.equal(resolveBusAddress(undefined, '/run/user/1000'), 'unix:path=/run/user/1000/bus')
})

void test('resolveBusAddress throws when neither an override nor XDG_RUNTIME_DIR is available', () => {
	assert.throws(() => resolveBusAddress(undefined, undefined), /XDG_RUNTIME_DIR/)
})

void test('computeBackoffMs grows exponentially and caps at maxDelayMs', () => {
	const options = { initialDelayMs: 1000, maxDelayMs: 8000 }
	assert.equal(computeBackoffMs(0, options), 1000)
	assert.equal(computeBackoffMs(1, options), 2000)
	assert.equal(computeBackoffMs(2, options), 4000)
	assert.equal(computeBackoffMs(3, options), 8000)
	assert.equal(computeBackoffMs(10, options), 8000, 'must stay capped, not keep growing')
})

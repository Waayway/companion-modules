import { test } from 'node:test'
import assert from 'node:assert/strict'
import { secondsToMicroseconds } from './seek.js'

void test('secondsToMicroseconds converts and rounds to a bigint', () => {
	assert.equal(secondsToMicroseconds(10), 10_000_000n)
	assert.equal(secondsToMicroseconds(-5), -5_000_000n)
	assert.equal(secondsToMicroseconds(0.0005), 500n)
})

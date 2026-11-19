import { test } from 'node:test'
import assert from 'node:assert/strict'
import { entriesForPreset, nextPreset, parseCycleOrder } from './cycle.js'

test('parseCycleOrder parses a comma list of non-negative integers', () => {
	assert.deepEqual(parseCycleOrder('1,2,0'), [1, 2, 0])
})

test('parseCycleOrder ignores junk tokens', () => {
	assert.deepEqual(parseCycleOrder('1, abc, 2, -5, 0'), [1, 2, 0])
})

test('parseCycleOrder falls back to the default when nothing usable is left', () => {
	assert.deepEqual(parseCycleOrder('abc, -1,'), [1, 2, 0])
	assert.deepEqual(parseCycleOrder(''), [1, 2, 0])
})

test('parseCycleOrder falls back to a provided fallback', () => {
	assert.deepEqual(parseCycleOrder('', [3, 4]), [3, 4])
})

test('entriesForPreset puts the chosen preset first, followed by the rest of the cycle order', () => {
	assert.deepEqual(entriesForPreset(1, [1, 2, 0]), [1, 2, 0])
	assert.deepEqual(entriesForPreset(2, [1, 2, 0]), [2, 1, 0])
})

test('entriesForPreset keeps the full cycle order when the preset is not part of it', () => {
	assert.deepEqual(entriesForPreset(-1, [1, 2, 0]), [-1, 1, 2, 0])
})

test('nextPreset wraps around the cycle order', () => {
	assert.equal(nextPreset(1, [1, 2, 0]), 2)
	assert.equal(nextPreset(0, [1, 2, 0]), 1)
})

test('nextPreset falls back to the first entry when the current preset is unknown or not in the cycle', () => {
	assert.equal(nextPreset(null, [1, 2, 0]), 1)
	assert.equal(nextPreset(-1, [1, 2, 0]), 1)
})

test('nextPreset returns the current value when the cycle order is empty', () => {
	assert.equal(nextPreset(5, []), 5)
	assert.equal(nextPreset(null, []), 0)
})

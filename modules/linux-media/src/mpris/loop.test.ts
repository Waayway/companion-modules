import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLoopStatus, nextLoopStatus } from './loop.js'

void test('nextLoopStatus cycles None -> Playlist -> Track -> None', () => {
	assert.equal(nextLoopStatus('None'), 'Playlist')
	assert.equal(nextLoopStatus('Playlist'), 'Track')
	assert.equal(nextLoopStatus('Track'), 'None')
})

void test('nextLoopStatus restarts the cycle at None for an unrecognised or missing value', () => {
	assert.equal(nextLoopStatus(null), 'None')
	assert.equal(nextLoopStatus('Unknown'), 'None')
})

void test('isLoopStatus recognises only the three MPRIS loop modes', () => {
	assert.equal(isLoopStatus('None'), true)
	assert.equal(isLoopStatus('Playlist'), true)
	assert.equal(isLoopStatus('Track'), true)
	assert.equal(isLoopStatus('Shuffle'), false)
	assert.equal(isLoopStatus(''), false)
})

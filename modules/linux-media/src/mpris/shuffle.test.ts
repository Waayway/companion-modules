import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveShuffleValue } from './shuffle.js'

void test('resolveShuffleValue forces on and off regardless of the current value', () => {
	assert.equal(resolveShuffleValue(false, 'on'), true)
	assert.equal(resolveShuffleValue(true, 'on'), true)
	assert.equal(resolveShuffleValue(true, 'off'), false)
	assert.equal(resolveShuffleValue(false, 'off'), false)
})

void test('resolveShuffleValue toggles the current value', () => {
	assert.equal(resolveShuffleValue(true, 'toggle'), false)
	assert.equal(resolveShuffleValue(false, 'toggle'), true)
})

void test('resolveShuffleValue treats an unknown current value as off before toggling', () => {
	assert.equal(resolveShuffleValue(null, 'toggle'), true)
})

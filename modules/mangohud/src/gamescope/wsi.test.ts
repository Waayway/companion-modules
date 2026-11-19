import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWsiEnabled } from './wsi.js'

test('ENABLE_GAMESCOPE_WSI="0" is off', () => {
	assert.equal(parseWsiEnabled('0'), false)
})

test('any other value is on', () => {
	assert.equal(parseWsiEnabled('1'), true)
	assert.equal(parseWsiEnabled('yes'), true)
})

test('unset is on', () => {
	assert.equal(parseWsiEnabled(undefined), true)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHandshake } from './handshake.js'

test('parseHandshake extracts all three fields', () => {
	const result = parseHandshake(':MangoHudControlVersion=1;:DeviceName=fake;:MangoHudVersion=0.8;')
	assert.deepEqual(result, { controlVersion: '1', deviceName: 'fake', mangoHudVersion: '0.8' })
})

test('parseHandshake tolerates a partial or empty handshake', () => {
	assert.deepEqual(parseHandshake(':MangoHudVersion=0.9;'), { mangoHudVersion: '0.9' })
	assert.deepEqual(parseHandshake(''), {})
	assert.deepEqual(parseHandshake('garbage'), {})
})

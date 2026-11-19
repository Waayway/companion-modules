import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMprisPlayerName } from './names.js'

void test('isMprisPlayerName accepts names under the MPRIS prefix', () => {
	assert.equal(isMprisPlayerName('org.mpris.MediaPlayer2.spotify'), true)
	assert.equal(isMprisPlayerName('org.mpris.MediaPlayer2.chromium.instance1234'), true)
})

void test('isMprisPlayerName rejects everything else, including the bare prefix', () => {
	assert.equal(isMprisPlayerName('org.freedesktop.DBus'), false)
	assert.equal(isMprisPlayerName('org.mpris.MediaPlayer2'), false)
	assert.equal(isMprisPlayerName(':1.42'), false)
})

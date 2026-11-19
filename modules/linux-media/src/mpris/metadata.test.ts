import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMetadata } from './metadata.js'

void test('parseMetadata reads plain (already-unwrapped) fields', () => {
	const metadata = parseMetadata({
		'xesam:title': 'Song Title',
		'xesam:artist': ['Artist One', 'Artist Two'],
		'xesam:album': 'Album Name',
		'mpris:length': 180_000_000,
		'mpris:artUrl': 'file:///art.png',
	})
	assert.deepEqual(metadata, {
		title: 'Song Title',
		artist: 'Artist One, Artist Two',
		album: 'Album Name',
		lengthMicroseconds: 180_000_000,
		artUrl: 'file:///art.png',
	})
})

void test('parseMetadata unwraps Variant-shaped fields, including a bigint length', () => {
	const metadata = parseMetadata({
		'xesam:title': { signature: 's', value: 'Song Title' },
		'xesam:artist': { signature: 'as', value: ['Solo Artist'] },
		'mpris:length': { signature: 'x', value: 180_000_000n },
	})
	assert.equal(metadata.title, 'Song Title')
	assert.equal(metadata.artist, 'Solo Artist')
	assert.equal(metadata.lengthMicroseconds, 180_000_000)
})

void test('parseMetadata tolerates a completely missing metadata dict', () => {
	assert.deepEqual(parseMetadata(undefined), {
		title: null,
		artist: null,
		album: null,
		lengthMicroseconds: null,
		artUrl: null,
	})
})

void test('parseMetadata tolerates players that omit individual fields', () => {
	const metadata = parseMetadata({ 'xesam:title': 'Only Title' })
	assert.equal(metadata.title, 'Only Title')
	assert.equal(metadata.artist, null)
	assert.equal(metadata.album, null)
	assert.equal(metadata.lengthMicroseconds, null)
	assert.equal(metadata.artUrl, null)
})

void test('parseMetadata tolerates a malformed artist field (not an array)', () => {
	const metadata = parseMetadata({ 'xesam:artist': 'Not An Array' })
	assert.equal(metadata.artist, null)
})

void test('parseMetadata drops an empty title instead of treating it as present', () => {
	const metadata = parseMetadata({ 'xesam:title': '' })
	assert.equal(metadata.title, null)
})

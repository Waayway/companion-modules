import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampVolumePercent, percentToVolume, stepVolumePercent, volumeToPercent } from './volume.js'

void test('clampVolumePercent clamps to 0-100', () => {
	assert.equal(clampVolumePercent(-10), 0)
	assert.equal(clampVolumePercent(150), 100)
	assert.equal(clampVolumePercent(42), 42)
})

void test('volumeToPercent rounds and clamps the MPRIS 0.0-1.0 double', () => {
	assert.equal(volumeToPercent(0), 0)
	assert.equal(volumeToPercent(1), 100)
	assert.equal(volumeToPercent(0.567), 57)
	assert.equal(volumeToPercent(1.5), 100, 'a player reporting an out-of-range volume must not overshoot 100')
	assert.equal(volumeToPercent(-0.5), 0)
})

void test('percentToVolume clamps before converting to the 0.0-1.0 double', () => {
	assert.equal(percentToVolume(50), 0.5)
	assert.equal(percentToVolume(-10), 0)
	assert.equal(percentToVolume(150), 1)
})

void test('stepVolumePercent steps up and down, clamped at the edges', () => {
	assert.equal(stepVolumePercent(50, 5, 1), 55)
	assert.equal(stepVolumePercent(50, 5, -1), 45)
	assert.equal(stepVolumePercent(98, 5, 1), 100)
	assert.equal(stepVolumePercent(2, 5, -1), 0)
})

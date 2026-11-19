import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelForPreset, parsePresetLabels } from './labels.js'

test('parsePresetLabels parses number=label pairs', () => {
	assert.deepEqual(parsePresetLabels('0=Off,1=Bar,2=Detail'), { 0: 'Off', 1: 'Bar', 2: 'Detail' })
})

test('parsePresetLabels tolerates whitespace', () => {
	assert.deepEqual(parsePresetLabels(' 0 = Off , 1 = Bar '), { 0: 'Off', 1: 'Bar' })
})

test('parsePresetLabels ignores malformed pairs without throwing', () => {
	assert.deepEqual(parsePresetLabels('0=Off,nope,1=,2=Detail'), { 0: 'Off', 2: 'Detail' })
})

test('parsePresetLabels falls back to the default when nothing usable is left', () => {
	assert.deepEqual(parsePresetLabels('nope,also-nope'), { 0: 'Off', 1: 'Bar', 2: 'Detail' })
	assert.deepEqual(parsePresetLabels(''), { 0: 'Off', 1: 'Bar', 2: 'Detail' })
})

test('parsePresetLabels falls back to a provided fallback', () => {
	assert.deepEqual(parsePresetLabels('', { 9: 'Custom' }), { 9: 'Custom' })
})

test('labelForPreset returns the mapped label, the number as a string when unmapped, and ? when unknown', () => {
	const labels = { 0: 'Off', 1: 'Bar' }
	assert.equal(labelForPreset(labels, 0), 'Off')
	assert.equal(labelForPreset(labels, 5), '5')
	assert.equal(labelForPreset(labels, null), '?')
})

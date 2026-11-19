import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasPresetLine, parsePresetLine } from './parse.js'

test('parsePresetLine reads the first entry and the rest of the list', () => {
	assert.deepEqual(parsePresetLine('fps=1\npreset=1,2,0\nno_display=0\n'), [1, 2, 0])
})

test('parsePresetLine returns null when there is no preset= line', () => {
	assert.equal(parsePresetLine('fps=1\nno_display=0\n'), null)
})

test('parsePresetLine ignores a commented-out preset= line', () => {
	assert.equal(parsePresetLine('#preset=1,2,0\nfps=1\n'), null)
})

test('parsePresetLine filters out non-numeric junk in the list', () => {
	assert.deepEqual(parsePresetLine('preset=1, abc ,2\n'), [1, 2])
})

test('parsePresetLine tolerates stray whitespace around the entries', () => {
	assert.deepEqual(parsePresetLine('preset = 1 , 2 , 0 \n'), [1, 2, 0])
})

test('hasPresetLine reflects whether a preset= line is present', () => {
	assert.equal(hasPresetLine('preset=0\n'), true)
	assert.equal(hasPresetLine('fps=1\n'), false)
})

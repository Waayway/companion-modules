import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatPresetLine, replacePresetLine } from './format.js'

test('formatPresetLine joins entries with commas', () => {
	assert.equal(formatPresetLine([1, 2, 0]), 'preset=1,2,0')
})

test('replacePresetLine rewrites an existing line in place, keeping the rest of the file', () => {
	const before = 'fps=1\npreset=0,1,2\nno_display=0\n'
	const after = replacePresetLine(before, [1, 2, 0])
	assert.equal(after, 'fps=1\npreset=1,2,0\nno_display=0\n')
})

test('replacePresetLine prepends a line when the file has none', () => {
	const before = 'fps=1\nno_display=0\n'
	const after = replacePresetLine(before, [1, 2, 0])
	assert.equal(after, 'preset=1,2,0\nfps=1\nno_display=0\n')
})

test('replacePresetLine on an empty file produces just the preset line', () => {
	assert.equal(replacePresetLine('', [0, 1, 2]), 'preset=0,1,2\n')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatGamescopeMode, parseGamescopeFlags } from './cmdline.js'

test('parses HDR/VRR flags and -W/-H/-r values given as separate args', () => {
	const flags = parseGamescopeFlags([
		'gamescope',
		'--hdr-enabled',
		'--adaptive-sync',
		'-W',
		'2560',
		'-H',
		'1440',
		'-r',
		'144',
	])
	assert.deepEqual(flags, { hdrRequested: true, vrrRequested: true, width: 2560, height: 1440, refresh: 144 })
})

test('parses the long flag forms, including "--flag=value"', () => {
	const flags = parseGamescopeFlags([
		'gamescope',
		'--output-width=1920',
		'--output-height',
		'1080',
		'--nested-refresh=60',
	])
	assert.deepEqual(flags, { hdrRequested: false, vrrRequested: false, width: 1920, height: 1080, refresh: 60 })
})

test('missing -W/-H/-r read as null, not a throw', () => {
	const flags = parseGamescopeFlags(['gamescope'])
	assert.deepEqual(flags, { hdrRequested: false, vrrRequested: false, width: null, height: null, refresh: null })
})

test('ignores everything after a bare "--": the wrapped command is not gamescope flags', () => {
	const flags = parseGamescopeFlags([
		'gamescope',
		'-W',
		'1920',
		'--',
		'my-game.exe',
		'--hdr-enabled',
		'--adaptive-sync',
		'-H',
		'1080',
	])
	assert.deepEqual(flags, { hdrRequested: false, vrrRequested: false, width: 1920, height: null, refresh: null })
})

test('a trailing flag with no value reads as null instead of consuming the next arg', () => {
	const flags = parseGamescopeFlags(['gamescope', '-W', '1920', '-H'])
	assert.equal(flags.width, 1920)
	assert.equal(flags.height, null)
})

test('formatGamescopeMode renders width/height with "?" for missing parts', () => {
	assert.equal(formatGamescopeMode({ width: 2560, height: 1440, refresh: 144 }), '2560x1440@144')
	assert.equal(formatGamescopeMode({ width: null, height: 1440, refresh: null }), '?x1440')
	assert.equal(formatGamescopeMode({ width: null, height: null, refresh: null }), '?x?')
})

test('formatGamescopeMode omits "@" entirely when refresh is unknown', () => {
	assert.equal(formatGamescopeMode({ width: 1920, height: 1080, refresh: null }), '1920x1080')
})

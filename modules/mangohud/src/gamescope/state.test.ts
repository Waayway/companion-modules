import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeGamescopeVariables, type GamescopeSnapshot } from './state.js'
import type { GamescopeFlags } from './cmdline.js'

const FLAGS: GamescopeFlags = { hdrRequested: false, vrrRequested: false, width: 1920, height: 1080, refresh: 60 }

interface SnapshotOverrides {
	wsiEnabled?: boolean | null
	atoms?: Record<string, number[]>
	flags?: Partial<GamescopeFlags>
}

function snapshot(overrides: SnapshotOverrides): GamescopeSnapshot {
	return {
		running: true,
		wsiEnabled: 'wsiEnabled' in overrides ? (overrides.wsiEnabled as boolean | null) : true,
		atoms: overrides.atoms ?? {},
		flags: { ...FLAGS, ...overrides.flags },
	}
}

test('gamescope not running: everything reads off/"-"', () => {
	const result = computeGamescopeVariables({ running: false, flags: null, wsiEnabled: null, atoms: {} })
	assert.deepEqual(result, { gs_running: 'off', gs_hdr: 'off', gs_vrr: 'off', gs_wsi: '-', gs_mode: '-' })
})

test('gamescope running but flags unknown (defensive): treated the same as not running', () => {
	const result = computeGamescopeVariables({ running: true, flags: null, wsiEnabled: null, atoms: {} })
	assert.equal(result.gs_running, 'off')
})

// requested / atom present / live -> expected state, exhaustively, for the HDR atom (same rule as VRR).
const STATE_TABLE: { requested: boolean; atomValues: number[] | null; expected: 'off' | 'on' | 'req' }[] = [
	{ requested: false, atomValues: null, expected: 'off' },
	{ requested: false, atomValues: [0], expected: 'off' },
	{ requested: false, atomValues: [1], expected: 'off' },
	{ requested: true, atomValues: null, expected: 'on' },
	{ requested: true, atomValues: [1], expected: 'on' },
	{ requested: true, atomValues: [7], expected: 'on' },
	{ requested: true, atomValues: [0], expected: 'req' },
	{ requested: true, atomValues: [0, 0], expected: 'req' },
	{ requested: true, atomValues: [], expected: 'req' },
	{ requested: true, atomValues: [1, 0], expected: 'on' },
]

for (const { requested, atomValues, expected } of STATE_TABLE) {
	test(`HDR requested=${requested} atom=${JSON.stringify(atomValues)} -> ${expected}`, () => {
		const atoms: Record<string, number[]> = atomValues === null ? {} : { GAMESCOPE_HDR_OUTPUT_FEEDBACK: atomValues }
		const result = computeGamescopeVariables(snapshot({ flags: { hdrRequested: requested }, atoms }))
		assert.equal(result.gs_hdr, expected)
	})

	test(`VRR requested=${requested} atom=${JSON.stringify(atomValues)} -> ${expected}`, () => {
		const atoms: Record<string, number[]> = atomValues === null ? {} : { GAMESCOPE_VRR_FEEDBACK: atomValues }
		const result = computeGamescopeVariables(snapshot({ flags: { vrrRequested: requested }, atoms }))
		assert.equal(result.gs_vrr, expected)
	})
}

test('HDR and VRR states are computed independently of each other', () => {
	const result = computeGamescopeVariables(
		snapshot({
			flags: { hdrRequested: true, vrrRequested: true },
			atoms: { GAMESCOPE_HDR_OUTPUT_FEEDBACK: [1], GAMESCOPE_VRR_FEEDBACK: [0] },
		}),
	)
	assert.equal(result.gs_hdr, 'on')
	assert.equal(result.gs_vrr, 'req')
})

test('an atom name must contain both required substrings; a decoy with only one is ignored', () => {
	const result = computeGamescopeVariables(
		snapshot({
			flags: { hdrRequested: true },
			atoms: { SOME_OTHER_FEEDBACK: [0] }, // "FEEDBACK" but no "HDR" -> not a match
		}),
	)
	assert.equal(result.gs_hdr, 'on', 'falls back to trusting the flag since no real HDR atom was found')
})

test('gs_wsi reflects wsiEnabled: true -> "on", false -> "off", null -> "-"', () => {
	assert.equal(computeGamescopeVariables(snapshot({ wsiEnabled: true })).gs_wsi, 'on')
	assert.equal(computeGamescopeVariables(snapshot({ wsiEnabled: false })).gs_wsi, 'off')
	assert.equal(computeGamescopeVariables(snapshot({ wsiEnabled: null })).gs_wsi, '-')
})

test('gs_mode is formatted from the flags when running', () => {
	const result = computeGamescopeVariables(snapshot({ flags: { width: 2560, height: 1440, refresh: 144 } }))
	assert.equal(result.gs_mode, '2560x1440@144')
})

test('gs_running is "on" whenever running is true and flags are present', () => {
	assert.equal(computeGamescopeVariables(snapshot({})).gs_running, 'on')
})

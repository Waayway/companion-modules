import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GamescopeManager, type GamescopeManagerDeps, type GamescopeManagerHost } from './manager.js'
import type { GamescopeProcess } from './process.js'
import type { GameProcess } from './environ.js'
import type { GamescopeFlags } from './cmdline.js'

const FLAGS: GamescopeFlags = { hdrRequested: false, vrrRequested: false, width: 1920, height: 1080, refresh: 60 }

function makeHost(): {
	host: GamescopeManagerHost
	setCalls: Record<string, string>[]
	feedbackCalls: string[][]
	logs: [string, string][]
} {
	const setCalls: Record<string, string>[] = []
	const feedbackCalls: string[][] = []
	const logs: [string, string][] = []
	const host: GamescopeManagerHost = {
		setVariableValues: (values) => setCalls.push(values),
		checkFeedbacks: (...types) => feedbackCalls.push(types),
		log: (level, message) => logs.push([level, message]),
	}
	return { host, setCalls, feedbackCalls, logs }
}

interface FakeState {
	gamescope: GamescopeProcess | null
	game: GameProcess | null
	atomsResult: Record<string, number[]> | Error
	findGamescopeCalls: number
	findGameCalls: number
	readAtomsCalls: string[]
}

function makeDeps(initial: Partial<FakeState> = {}): { deps: GamescopeManagerDeps; state: FakeState } {
	const state: FakeState = {
		gamescope: null,
		game: null,
		atomsResult: {},
		findGamescopeCalls: 0,
		findGameCalls: 0,
		readAtomsCalls: [],
		...initial,
	}
	const deps: GamescopeManagerDeps = {
		findGamescopeProcess: () => {
			state.findGamescopeCalls += 1
			return state.gamescope
		},
		findGameProcessInsideGamescope: () => {
			state.findGameCalls += 1
			return state.game
		},
		readRootAtoms: async (display) => {
			state.readAtomsCalls.push(display)
			if (state.atomsResult instanceof Error) throw state.atomsResult
			return state.atomsResult
		},
		getuid: () => 1000,
	}
	return { deps, state }
}

test('no gamescope process: variables read off/"-" and every mapped feedback is checked on the first poll', async () => {
	const { host, setCalls, feedbackCalls } = makeHost()
	const { deps } = makeDeps({ gamescope: null })
	const manager = new GamescopeManager(host, deps)

	await manager.poll()

	assert.deepEqual(setCalls, [{ gs_running: 'off', gs_hdr: 'off', gs_vrr: 'off', gs_wsi: '-', gs_mode: '-' }])
	assert.equal(feedbackCalls.length, 1)
	assert.deepEqual(
		new Set(feedbackCalls[0]),
		new Set([
			'gamescope_running',
			'gamescope_hdr_on',
			'gamescope_hdr_req',
			'gamescope_vrr_on',
			'gamescope_vrr_req',
			'gamescope_wsi_off',
		]),
	)
	assert.equal(manager.getState().gs_running, 'off')
})

test('gamescope running with no game process found inside it trusts the cmdline flags and keeps rescanning', async () => {
	const { host, setCalls } = makeHost()
	const gamescope: GamescopeProcess = { pid: 123, flags: { ...FLAGS, hdrRequested: true } }
	const { deps, state } = makeDeps({ gamescope, game: null })
	const manager = new GamescopeManager(host, deps)

	await manager.poll()
	assert.deepEqual(setCalls[0], { gs_running: 'on', gs_hdr: 'on', gs_vrr: 'off', gs_wsi: '-', gs_mode: '1920x1080@60' })
	assert.equal(state.findGameCalls, 1)

	await manager.poll()
	assert.equal(state.findGameCalls, 2, 'display stays unknown, so every poll rescans for the game process')
})

test('once the game process is found, its display is cached and not rescanned while the pid stays the same', async () => {
	const { host } = makeHost()
	const gamescope: GamescopeProcess = { pid: 50, flags: { ...FLAGS, hdrRequested: true, vrrRequested: true } }
	const game: GameProcess = { pid: 99, display: ':1', xauthority: null, wsiEnabled: true }
	const { deps, state } = makeDeps({
		gamescope,
		game,
		atomsResult: { GAMESCOPE_HDR_OUTPUT_FEEDBACK: [1], GAMESCOPE_VRR_FEEDBACK: [1] },
	})
	const manager = new GamescopeManager(host, deps)

	await manager.poll()
	assert.equal(state.findGameCalls, 1)
	assert.deepEqual(state.readAtomsCalls, [':1'])

	await manager.poll()
	assert.equal(state.findGameCalls, 1, 'pid unchanged and display known: no rescan')
	assert.deepEqual(state.readAtomsCalls, [':1', ':1'])
})

test('a gamescope pid change forces a rescan even though a display was already cached', async () => {
	const { host } = makeHost()
	const game: GameProcess = { pid: 99, display: ':1', xauthority: null, wsiEnabled: true }
	const { deps, state } = makeDeps({ gamescope: { pid: 50, flags: FLAGS }, game })
	const manager = new GamescopeManager(host, deps)

	await manager.poll()
	assert.equal(state.findGameCalls, 1)

	state.gamescope = { pid: 51, flags: FLAGS }
	await manager.poll()
	assert.equal(state.findGameCalls, 2, 'new gamescope pid: rescan even though the previous display was known')
})

test('XAUTHORITY is set from the game process environ during the atoms read and restored afterwards', async () => {
	const { host } = makeHost()
	const game: GameProcess = { pid: 99, display: ':1', xauthority: '/run/user/1000/.fake-xauth', wsiEnabled: true }
	const { deps } = makeDeps({ gamescope: { pid: 50, flags: FLAGS }, game })
	let xauthorityDuringRead: string | undefined
	deps.readRootAtoms = async () => {
		xauthorityDuringRead = process.env.XAUTHORITY
		return {}
	}
	const manager = new GamescopeManager(host, deps)

	const previous = process.env.XAUTHORITY
	process.env.XAUTHORITY = '/was/here/before'
	try {
		await manager.poll()
		assert.equal(xauthorityDuringRead, '/run/user/1000/.fake-xauth')
		assert.equal(process.env.XAUTHORITY, '/was/here/before')
	} finally {
		if (previous === undefined) delete process.env.XAUTHORITY
		else process.env.XAUTHORITY = previous
	}
})

test('a failing atoms read logs once, treats atoms as empty (trusting the flags), and forces a rescan on the next poll', async () => {
	const { host, logs } = makeHost()
	const game: GameProcess = { pid: 99, display: ':1', xauthority: null, wsiEnabled: true }
	const { deps, state } = makeDeps({
		gamescope: { pid: 50, flags: { ...FLAGS, hdrRequested: true } },
		game,
		atomsResult: new Error('x11 boom'),
	})
	const manager = new GamescopeManager(host, deps)

	await manager.poll()
	assert.equal(manager.getState().gs_hdr, 'on', 'no atom read succeeded, so the flag is trusted')
	assert.equal(logs.length, 1)
	assert.equal(logs[0][0], 'warn')

	state.atomsResult = {}
	await manager.poll()
	assert.equal(state.findGameCalls, 2, 'the failed read forces a rescan on the next poll')
	assert.equal(logs.length, 1, 'only the first failure of a streak is logged')
})

test('only variables that changed since the last poll are pushed, with only their mapped feedbacks checked', async () => {
	const { host, setCalls, feedbackCalls } = makeHost()
	const game: GameProcess = { pid: 99, display: ':1', xauthority: null, wsiEnabled: true }
	const { deps, state } = makeDeps({
		gamescope: { pid: 50, flags: { ...FLAGS, hdrRequested: true } },
		game,
		atomsResult: { GAMESCOPE_HDR_OUTPUT_FEEDBACK: [0] },
	})
	const manager = new GamescopeManager(host, deps)

	await manager.poll() // gs_hdr starts as "req" (requested, atom present, zero)
	setCalls.length = 0
	feedbackCalls.length = 0

	state.atomsResult = { GAMESCOPE_HDR_OUTPUT_FEEDBACK: [1] } // now live -> "on"
	await manager.poll()

	assert.deepEqual(setCalls, [{ gs_hdr: 'on' }])
	assert.deepEqual(feedbackCalls, [['gamescope_hdr_on', 'gamescope_hdr_req']])
})

test('getState() reflects the latest computed variables even across unchanged polls', async () => {
	const { host } = makeHost()
	const { deps } = makeDeps({ gamescope: null })
	const manager = new GamescopeManager(host, deps)

	await manager.poll()
	await manager.poll()

	assert.deepEqual(manager.getState(), { gs_running: 'off', gs_hdr: 'off', gs_vrr: 'off', gs_wsi: '-', gs_mode: '-' })
})

test('an in-flight poll is not re-entered by a concurrent poll() call', async () => {
	const { host } = makeHost()
	const game: GameProcess = { pid: 99, display: ':1', xauthority: null, wsiEnabled: true }
	const { deps, state } = makeDeps({ gamescope: { pid: 50, flags: FLAGS }, game })
	let resolveAtoms = (): void => {}
	deps.readRootAtoms = async () =>
		new Promise((resolve) => {
			resolveAtoms = () => resolve({})
		})
	const manager = new GamescopeManager(host, deps)

	const first = manager.poll()
	const second = manager.poll()
	resolveAtoms()
	await Promise.all([first, second])

	assert.equal(state.findGameCalls, 1, 'the concurrent call returned immediately instead of starting a second poll')
})

test('pollMs is clamped to 500ms and stop() halts further polling', async () => {
	const { host } = makeHost()
	const { deps, state } = makeDeps({ gamescope: null })
	const manager = new GamescopeManager(host, deps)

	manager.configure({ procRoot: '/fake', pollMs: 10 })
	await new Promise((resolve) => setTimeout(resolve, 20))
	assert.equal(state.findGamescopeCalls, 1, 'only the immediate initial poll has run so far')

	await new Promise((resolve) => setTimeout(resolve, 600))
	assert.equal(state.findGamescopeCalls, 2, 'the next poll only fires after the clamped 500ms, not the requested 10ms')

	manager.stop()
	await new Promise((resolve) => setTimeout(resolve, 600))
	assert.equal(state.findGamescopeCalls, 2, 'stop() prevents further polls')
})

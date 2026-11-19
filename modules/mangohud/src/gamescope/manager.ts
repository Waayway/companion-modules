import { findGamescopeProcess, type GamescopeProcess } from './process.js'
import { findGameProcessInsideGamescope, type GameProcess } from './environ.js'
import { readRootAtoms } from './atoms.js'
import { computeGamescopeVariables, type GamescopeSnapshot, type GamescopeVariables } from './state.js'

const MIN_POLL_MS = 500
const GAMESCOPE_VARIABLE_KEYS = ['gs_running', 'gs_hdr', 'gs_vrr', 'gs_wsi', 'gs_mode'] as const
type GamescopeVariableKey = (typeof GAMESCOPE_VARIABLE_KEYS)[number]

const FEEDBACKS_FOR_VARIABLE: Partial<Record<GamescopeVariableKey, string[]>> = {
	gs_running: ['gamescope_running'],
	gs_hdr: ['gamescope_hdr_on', 'gamescope_hdr_req'],
	gs_vrr: ['gamescope_vrr_on', 'gamescope_vrr_req'],
	gs_wsi: ['gamescope_wsi_off'],
}

const NOT_RUNNING: GamescopeVariables = { gs_running: 'off', gs_hdr: 'off', gs_vrr: 'off', gs_wsi: '-', gs_mode: '-' }

export interface GamescopeManagerHost {
	setVariableValues(values: Partial<Record<GamescopeVariableKey, string>>): void
	checkFeedbacks(feedbackType: string, ...feedbackTypes: string[]): void
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

export interface GamescopeManagerOptions {
	procRoot: string
	pollMs: number
}

export interface GamescopeManagerDeps {
	findGamescopeProcess(procRoot: string, ownUid: number): GamescopeProcess | null
	findGameProcessInsideGamescope(procRoot: string): GameProcess | null
	readRootAtoms(display: string): Promise<Record<string, number[]>>
	getuid(): number
}

const DEFAULT_DEPS: GamescopeManagerDeps = {
	findGamescopeProcess,
	findGameProcessInsideGamescope,
	readRootAtoms,
	getuid: () => process.getuid?.() ?? 0,
}

/**
 * Polls /proc for the gamescope process on a timer, only rescanning every process's environ for
 * the game process inside it (expensive) when the display is still unknown, the gamescope pid
 * changed, or the last atom read failed. Batches setVariableValues/checkFeedbacks to changed keys.
 */
export class GamescopeManager {
	private procRoot = '/proc'
	private pollMs = 2000
	private timer: NodeJS.Timeout | null = null
	private polling = false
	private lastPushed: Partial<Record<GamescopeVariableKey, string>> = {}
	private current: GamescopeVariables = NOT_RUNNING
	private lastGamescopePid: number | null = null
	private cachedGame: GameProcess | null = null
	private atomsFailedLastTime = false
	private loggedAtomFailure = false

	constructor(
		private readonly host: GamescopeManagerHost,
		private readonly deps: GamescopeManagerDeps = DEFAULT_DEPS,
	) {}

	configure(options: GamescopeManagerOptions): void {
		this.stop()
		this.procRoot = options.procRoot
		this.pollMs = Math.max(MIN_POLL_MS, options.pollMs)
		void this.poll()
		this.timer = setInterval(() => void this.poll(), this.pollMs)
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = null
	}

	getState(): GamescopeVariables {
		return this.current
	}

	async poll(): Promise<void> {
		if (this.polling) return
		this.polling = true
		try {
			await this.doPoll()
		} finally {
			this.polling = false
		}
	}

	private async doPoll(): Promise<void> {
		const gamescope = this.deps.findGamescopeProcess(this.procRoot, this.deps.getuid())
		if (!gamescope) {
			this.cachedGame = null
			this.lastGamescopePid = null
			this.atomsFailedLastTime = false
			this.push({ running: false, flags: null, wsiEnabled: null, atoms: {} })
			return
		}

		const pidChanged = this.lastGamescopePid !== gamescope.pid
		this.lastGamescopePid = gamescope.pid

		const displayUnknown = this.cachedGame === null || this.cachedGame.display === null
		if (pidChanged || displayUnknown || this.atomsFailedLastTime) {
			this.cachedGame = this.deps.findGameProcessInsideGamescope(this.procRoot)
		}

		const atoms = await this.readAtoms()

		this.push({
			running: true,
			flags: gamescope.flags,
			wsiEnabled: this.cachedGame?.wsiEnabled ?? null,
			atoms,
		})
	}

	private async readAtoms(): Promise<Record<string, number[]>> {
		const display = this.cachedGame?.display
		if (!display) {
			this.atomsFailedLastTime = false
			return {}
		}

		const xauthority = this.cachedGame?.xauthority ?? null
		const previousXauthority = process.env.XAUTHORITY
		if (xauthority) process.env.XAUTHORITY = xauthority

		try {
			const atoms = await this.deps.readRootAtoms(display)
			this.atomsFailedLastTime = false
			this.loggedAtomFailure = false
			return atoms
		} catch (err) {
			this.atomsFailedLastTime = true
			if (!this.loggedAtomFailure) {
				this.loggedAtomFailure = true
				this.host.log('warn', `Failed to read X11 atoms from display ${display}: ${(err as Error).message}`)
			}
			return {}
		} finally {
			if (xauthority) {
				if (previousXauthority === undefined) delete process.env.XAUTHORITY
				else process.env.XAUTHORITY = previousXauthority
			}
		}
	}

	private push(snapshot: GamescopeSnapshot): void {
		const next = computeGamescopeVariables(snapshot)
		this.current = next

		const changed: Partial<Record<GamescopeVariableKey, string>> = {}
		for (const key of GAMESCOPE_VARIABLE_KEYS) {
			if (this.lastPushed[key] !== next[key]) changed[key] = next[key]
		}
		if (Object.keys(changed).length === 0) return

		this.lastPushed = next
		this.host.setVariableValues(changed)

		const feedbackIds = new Set<string>()
		for (const key of Object.keys(changed) as GamescopeVariableKey[]) {
			for (const id of FEEDBACKS_FOR_VARIABLE[key] ?? []) feedbackIds.add(id)
		}
		const [first, ...rest] = feedbackIds
		if (first) this.host.checkFeedbacks(first, ...rest)
	}
}

import { formatGamescopeMode, type GamescopeFlags } from './cmdline.js'

export type FeedbackState = 'off' | 'on' | 'req'

export interface GamescopeSnapshot {
	running: boolean
	/** null when gamescope is not running */
	flags: GamescopeFlags | null
	/** null when no game process (or its ENABLE_GAMESCOPE_WSI) could be found */
	wsiEnabled: boolean | null
	/** root window properties whose name contains "FEEDBACK"; empty when none were read */
	atoms: Record<string, number[]>
}

export interface GamescopeVariables {
	gs_running: 'on' | 'off'
	gs_hdr: FeedbackState
	gs_vrr: FeedbackState
	gs_wsi: 'on' | 'off' | '-'
	gs_mode: string
}

const NOT_RUNNING: GamescopeVariables = {
	gs_running: 'off',
	gs_hdr: 'off',
	gs_vrr: 'off',
	gs_wsi: '-',
	gs_mode: '-',
}

/** First CARDINAL value of the atom whose name contains every one of `requiredSubstrings`. */
function findAtomValues(atoms: Record<string, number[]>, requiredSubstrings: string[]): number[] | null {
	for (const [name, values] of Object.entries(atoms)) {
		if (requiredSubstrings.every((substring) => name.includes(substring))) return values
	}
	return null
}

/** not requested -> off; requested, no atom -> on (trust the flag); requested, atom -> on if live else req. */
function feedbackState(requested: boolean, atomValues: number[] | null): FeedbackState {
	if (!requested) return 'off'
	if (atomValues === null) return 'on'
	const live = atomValues.length > 0 && atomValues[0] !== 0
	return live ? 'on' : 'req'
}

export function computeGamescopeVariables(snapshot: GamescopeSnapshot): GamescopeVariables {
	if (!snapshot.running || !snapshot.flags) return NOT_RUNNING

	const hdrAtom = findAtomValues(snapshot.atoms, ['HDR', 'FEEDBACK'])
	const vrrAtom = findAtomValues(snapshot.atoms, ['VRR', 'FEEDBACK'])

	return {
		gs_running: 'on',
		gs_hdr: feedbackState(snapshot.flags.hdrRequested, hdrAtom),
		gs_vrr: feedbackState(snapshot.flags.vrrRequested, vrrAtom),
		gs_wsi: snapshot.wsiEnabled === null ? '-' : snapshot.wsiEnabled ? 'on' : 'off',
		gs_mode: formatGamescopeMode(snapshot.flags),
	}
}

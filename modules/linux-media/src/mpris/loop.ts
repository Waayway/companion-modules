/** The MPRIS `LoopStatus` cycle order: None -> Playlist -> Track -> None. */
export const LOOP_STATUS_CYCLE = ['None', 'Playlist', 'Track'] as const

export type LoopStatus = (typeof LOOP_STATUS_CYCLE)[number]

export function isLoopStatus(value: string): value is LoopStatus {
	return (LOOP_STATUS_CYCLE as readonly string[]).includes(value)
}

/** Advances to the next mode in the cycle. An unrecognised current value restarts the cycle at `None`. */
export function nextLoopStatus(current: string | null): LoopStatus {
	const index = current === null ? -1 : LOOP_STATUS_CYCLE.indexOf(current as LoopStatus)
	return LOOP_STATUS_CYCLE[(index + 1) % LOOP_STATUS_CYCLE.length] ?? 'None'
}

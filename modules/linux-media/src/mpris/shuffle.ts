export type ShuffleMode = 'toggle' | 'on' | 'off'

/** Resolves the next `Shuffle` value for a requested mode: force on/off, or toggle the current value. */
export function resolveShuffleValue(current: boolean | null, mode: ShuffleMode): boolean {
	if (mode === 'on') return true
	if (mode === 'off') return false
	return !(current ?? false)
}

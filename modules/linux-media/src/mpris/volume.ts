/** Clamps a volume percentage (as shown to the user) to the 0-100 range. */
export function clampVolumePercent(percent: number): number {
	return Math.max(0, Math.min(100, percent))
}

/** Converts the MPRIS `Volume` double (0.0-1.0) to a rounded, clamped percentage. */
export function volumeToPercent(volume: number): number {
	return clampVolumePercent(Math.round(volume * 100))
}

/** Converts a percentage (0-100, clamped first) to the MPRIS `Volume` double (0.0-1.0). */
export function percentToVolume(percent: number): number {
	return clampVolumePercent(percent) / 100
}

/** Steps a volume percentage up or down by `step`, clamped to 0-100. */
export function stepVolumePercent(currentPercent: number, step: number, direction: 1 | -1): number {
	return clampVolumePercent(currentPercent + step * direction)
}

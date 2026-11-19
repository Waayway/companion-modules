const DEFAULT_CYCLE_ORDER = [1, 2, 0]

/** Tolerant: ignores junk tokens, falls back to the default when nothing usable is left. */
export function parseCycleOrder(raw: string, fallback: number[] = DEFAULT_CYCLE_ORDER): number[] {
	const parsed = raw
		.split(',')
		.map((part) => Number.parseInt(part.trim(), 10))
		.filter((value) => Number.isInteger(value) && value >= 0)
	return parsed.length > 0 ? parsed : fallback
}

/** `preset=<n>,<the other presets in cycle order>`, matching the replaced daemon's write rule. */
export function entriesForPreset(preset: number, cycleOrder: number[]): number[] {
	return [preset, ...cycleOrder.filter((value) => value !== preset)]
}

export function nextPreset(current: number | null, cycleOrder: number[]): number {
	if (cycleOrder.length === 0) return current ?? 0
	if (current === null) return cycleOrder[0]
	const index = cycleOrder.indexOf(current)
	if (index === -1) return cycleOrder[0]
	return cycleOrder[(index + 1) % cycleOrder.length]
}

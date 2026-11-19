const DEFAULT_LABELS: Record<number, string> = { 0: 'Off', 1: 'Bar', 2: 'Detail' }

/** Tolerant: ignores malformed `k=v` pairs, falls back to the default when nothing usable is left. */
export function parsePresetLabels(
	raw: string,
	fallback: Record<number, string> = DEFAULT_LABELS,
): Record<number, string> {
	const result: Record<number, string> = {}
	for (const part of raw.split(',')) {
		const eq = part.indexOf('=')
		if (eq === -1) continue
		const key = Number.parseInt(part.slice(0, eq).trim(), 10)
		const label = part.slice(eq + 1).trim()
		if (!Number.isInteger(key) || label.length === 0) continue
		result[key] = label
	}
	return Object.keys(result).length > 0 ? result : fallback
}

export function labelForPreset(labels: Record<number, string>, preset: number | null): string {
	if (preset === null) return '?'
	return labels[preset] ?? String(preset)
}

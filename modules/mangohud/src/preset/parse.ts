const PRESET_LINE_RE = /^[ \t]*preset[ \t]*=[ \t]*([^\r\n]*)$/m

export function hasPresetLine(configText: string): boolean {
	return PRESET_LINE_RE.test(configText)
}

export function parsePresetLine(configText: string): number[] | null {
	const match = PRESET_LINE_RE.exec(configText)
	if (!match) return null
	return match[1]
		.split(',')
		.map((part) => Number.parseInt(part.trim(), 10))
		.filter((value) => Number.isInteger(value))
}

export { PRESET_LINE_RE }

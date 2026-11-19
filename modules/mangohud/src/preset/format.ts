import { PRESET_LINE_RE } from './parse.js'

export function formatPresetLine(entries: number[]): string {
	return `preset=${entries.join(',')}`
}

/**
 * Same rule as the replaced Python daemon: rewrite the existing `preset=` line in place,
 * or prepend one if the file has none yet.
 */
export function replacePresetLine(configText: string, entries: number[]): string {
	const newLine = formatPresetLine(entries)
	if (PRESET_LINE_RE.test(configText)) {
		return configText.replace(PRESET_LINE_RE, newLine)
	}
	return configText.length > 0 ? `${newLine}\n${configText}` : `${newLine}\n`
}

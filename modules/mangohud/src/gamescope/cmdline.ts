export interface GamescopeFlags {
	hdrRequested: boolean
	vrrRequested: boolean
	width: number | null
	height: number | null
	refresh: number | null
	/** -O / --prefer-output, comma-separated connector names; empty when not given */
	preferredOutputs: string[]
}

const WIDTH_FLAGS = ['-W', '--output-width']
const HEIGHT_FLAGS = ['-H', '--output-height']
const REFRESH_FLAGS = ['-r', '--nested-refresh']
const OUTPUT_FLAGS = ['-O', '--prefer-output']

/** Everything gamescope itself parses: cmdline args up to (not including) a bare "--", which separates the wrapped command's own args. */
function flagArgs(cmdline: string[]): string[] {
	const separator = cmdline.indexOf('--')
	return separator === -1 ? cmdline : cmdline.slice(0, separator)
}

function findFlagValue(args: string[], flags: string[]): string | null {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (flags.includes(arg)) return args[i + 1] ?? null
		const withEquals = flags.find((flag) => arg.startsWith(`${flag}=`))
		if (withEquals) return arg.slice(withEquals.length + 1)
	}
	return null
}

function parsePositiveInt(value: string | null): number | null {
	if (value === null) return null
	const parsed = Number.parseInt(value, 10)
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function parseGamescopeFlags(cmdline: string[]): GamescopeFlags {
	const args = flagArgs(cmdline)
	return {
		hdrRequested: args.includes('--hdr-enabled'),
		vrrRequested: args.includes('--adaptive-sync'),
		width: parsePositiveInt(findFlagValue(args, WIDTH_FLAGS)),
		height: parsePositiveInt(findFlagValue(args, HEIGHT_FLAGS)),
		refresh: parsePositiveInt(findFlagValue(args, REFRESH_FLAGS)),
		preferredOutputs: (findFlagValue(args, OUTPUT_FLAGS) ?? '')
			.split(',')
			.map((name) => name.trim())
			.filter((name) => name !== '' && name !== '*'),
	}
}

/** "<W>x<H>[@<r>]", missing width/height shown as "?"; the refresh part is omitted (not "@?") when unknown. */
export function formatGamescopeMode(flags: Pick<GamescopeFlags, 'width' | 'height' | 'refresh'>): string {
	const width = flags.width === null ? '?' : String(flags.width)
	const height = flags.height === null ? '?' : String(flags.height)
	const suffix = flags.refresh === null ? '' : `@${flags.refresh}`
	return `${width}x${height}${suffix}`
}

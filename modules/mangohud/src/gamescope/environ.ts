import path from 'node:path'
import { listPids, parseEnviron, readProcFileIfReadable } from './procfs.js'
import { parseWsiEnabled } from './wsi.js'

export interface GameProcess {
	pid: number
	display: string | null
	xauthority: string | null
	wsiEnabled: boolean
}

function looksLikeGame(cmdlineRaw: string | null): boolean {
	if (!cmdlineRaw) return false
	const lower = cmdlineRaw.toLowerCase()
	return lower.includes('.exe') || lower.includes('wine')
}

/**
 * The process "inside" gamescope: one whose environ has GAMESCOPE_WAYLAND_DISPLAY. Prefers one
 * whose cmdline looks like a game (.exe or wine, case-insensitive); falls back to the first match
 * found (ascending pid) when none does. Scans every pid's environ, so callers should only do this
 * when they actually need a fresh answer.
 */
export function findGameProcessInsideGamescope(procRoot: string): GameProcess | null {
	let preferred: GameProcess | null = null
	let fallback: GameProcess | null = null

	for (const pid of listPids(procRoot)) {
		const dir = path.join(procRoot, String(pid))
		const environRaw = readProcFileIfReadable(path.join(dir, 'environ'))
		if (environRaw === null) continue

		const env = parseEnviron(environRaw)
		if (!('GAMESCOPE_WAYLAND_DISPLAY' in env)) continue

		const candidate: GameProcess = {
			pid,
			display: env.DISPLAY ?? null,
			xauthority: env.XAUTHORITY ?? null,
			wsiEnabled: parseWsiEnabled(env.ENABLE_GAMESCOPE_WSI),
		}
		fallback ??= candidate
		if (!preferred && looksLikeGame(readProcFileIfReadable(path.join(dir, 'cmdline')))) {
			preferred = candidate
		}
	}

	return preferred ?? fallback
}

import path from 'node:path'
import { parseGamescopeFlags, type GamescopeFlags } from './cmdline.js'
import { listPids, readProcFileIfReadable, splitNulSeparated, statOwnerUid } from './procfs.js'

export interface GamescopeProcess {
	pid: number
	flags: GamescopeFlags
}

const GAMESCOPE_COMM_NAMES = new Set(['gamescope', 'gamescope-wl'])

/** The first (lowest-pid) process owned by `ownUid` whose /proc/<pid>/comm is gamescope or gamescope-wl. */
export function findGamescopeProcess(procRoot: string, ownUid: number): GamescopeProcess | null {
	for (const pid of listPids(procRoot)) {
		const dir = path.join(procRoot, String(pid))
		if (statOwnerUid(dir) !== ownUid) continue

		const comm = readProcFileIfReadable(path.join(dir, 'comm'))?.trim()
		if (!comm || !GAMESCOPE_COMM_NAMES.has(comm)) continue

		const cmdlineRaw = readProcFileIfReadable(path.join(dir, 'cmdline'))
		if (cmdlineRaw === null) continue

		return { pid, flags: parseGamescopeFlags(splitNulSeparated(cmdlineRaw)) }
	}
	return null
}

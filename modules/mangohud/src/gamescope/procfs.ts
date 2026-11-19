import fs from 'node:fs'

/** Numeric entries of a /proc-like directory, ascending. Missing root -> empty, not an error. */
export function listPids(procRoot: string): number[] {
	let entries: string[]
	try {
		entries = fs.readdirSync(procRoot)
	} catch {
		return []
	}
	return entries
		.filter((entry) => /^[0-9]+$/.test(entry))
		.map(Number)
		.sort((a, b) => a - b)
}

/** Any read failure (ENOENT, EACCES, or a /proc entry that vanished mid-scan) reads as "unavailable". */
export function readProcFileIfReadable(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, 'utf8')
	} catch {
		return null
	}
}

export function statOwnerUid(filePath: string): number | null {
	try {
		return fs.statSync(filePath).uid
	} catch {
		return null
	}
}

export function splitNulSeparated(raw: string): string[] {
	return raw.split('\0').filter((part) => part.length > 0)
}

/** /proc/<pid>/environ: NUL separated KEY=VALUE entries. */
export function parseEnviron(raw: string): Record<string, string> {
	const env: Record<string, string> = {}
	for (const entry of splitNulSeparated(raw)) {
		const eq = entry.indexOf('=')
		if (eq === -1) continue
		env[entry.slice(0, eq)] = entry.slice(eq + 1)
	}
	return env
}

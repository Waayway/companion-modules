import fs from 'node:fs'
import path from 'node:path'

const DRM_CLASS_DIR = 'class/drm'
const CARD_DIR_PATTERN = /^card\d+$/

function readFileIfExists(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, 'utf8')
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
		throw err
	}
}

/** The first card entry's device/gpu_busy_percent that exists (connector subdirs like card0-DP-1 are skipped). */
export function findGpuBusyPercentPath(sysfsRoot: string): string | null {
	const drmRoot = path.join(sysfsRoot, DRM_CLASS_DIR)
	let entries: string[]
	try {
		entries = fs.readdirSync(drmRoot)
	} catch {
		return null
	}

	for (const entry of entries.filter((name) => CARD_DIR_PATTERN.test(name)).sort()) {
		const busyPath = path.join(drmRoot, entry, 'device', 'gpu_busy_percent')
		if (readFileIfExists(busyPath) !== null) return busyPath
	}
	return null
}

export function readGpuBusyPercent(sysfsRoot: string): number | null {
	const busyPath = findGpuBusyPercentPath(sysfsRoot)
	if (busyPath === null) return null
	const raw = readFileIfExists(busyPath)
	if (raw === null) return null
	const percent = Number.parseInt(raw.trim(), 10)
	return Number.isFinite(percent) ? percent : null
}

import fs from 'node:fs'
import path from 'node:path'

const HWMON_CLASS_DIR = 'class/hwmon'

function readFileIfExists(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, 'utf8')
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
		throw err
	}
}

/** The first hwmon entry under sysfsRoot whose name file matches one of the given driver names. */
export function findHwmonDirByName(sysfsRoot: string, names: string[]): string | null {
	const hwmonRoot = path.join(sysfsRoot, HWMON_CLASS_DIR)
	let entries: string[]
	try {
		entries = fs.readdirSync(hwmonRoot)
	} catch {
		return null
	}

	for (const entry of entries.sort()) {
		const dir = path.join(hwmonRoot, entry)
		const name = readFileIfExists(path.join(dir, 'name'))?.trim()
		if (name && names.includes(name)) return dir
	}
	return null
}

/** temp1_input is millidegrees Celsius; rounded to a whole degree. */
export function readTemp1InputCelsius(hwmonDir: string): number | null {
	const raw = readFileIfExists(path.join(hwmonDir, 'temp1_input'))
	if (raw === null) return null
	const milliDegrees = Number.parseInt(raw.trim(), 10)
	if (!Number.isFinite(milliDegrees)) return null
	return Math.round(milliDegrees / 1000)
}

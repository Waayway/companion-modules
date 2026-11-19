import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { parsePresetLine } from './parse.js'
import { replacePresetLine } from './format.js'

const MAIN_CONFIG_FILE = 'MangoHud.conf'
const PRESETS_FILE = 'presets.conf'

export function readFileIfExists(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, 'utf8')
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
		throw err
	}
}

/** Write tmp, rename over the target: MangoHud re-arms its inotify watch on a rename-replace. */
export function atomicWriteFile(filePath: string, content: string): void {
	const dir = path.dirname(filePath)
	const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`)
	fs.writeFileSync(tmpPath, content, 'utf8')
	try {
		fs.renameSync(tmpPath, filePath)
	} catch (err) {
		fs.rmSync(tmpPath, { force: true })
		throw err
	}
}

/** Per-app config files, excluding MangoHud.conf itself and presets.conf (never a per-app file). */
export function listPerAppConfigFiles(dir: string): string[] {
	let names: string[]
	try {
		names = fs.readdirSync(dir)
	} catch {
		return []
	}
	return names.filter((name) => name.endsWith('.conf') && name !== MAIN_CONFIG_FILE && name !== PRESETS_FILE)
}

export function readActivePresetEntries(dir: string): number[] | null {
	const content = readFileIfExists(path.join(dir, MAIN_CONFIG_FILE))
	if (content === null) return null
	return parsePresetLine(content)
}

export interface ApplyPresetResult {
	updatedFiles: string[]
}

/**
 * Writes the preset= line to MangoHud.conf, and (when enabled) to every other *.conf file in
 * the directory that already has a preset= line of its own. presets.conf is never touched.
 */
export function applyPresetToDir(dir: string, entries: number[], updatePerAppConfigs: boolean): ApplyPresetResult {
	const updatedFiles: string[] = []
	const mainPath = path.join(dir, MAIN_CONFIG_FILE)
	const mainContent = readFileIfExists(mainPath) ?? ''
	atomicWriteFile(mainPath, replacePresetLine(mainContent, entries))
	updatedFiles.push(mainPath)

	if (updatePerAppConfigs) {
		for (const name of listPerAppConfigFiles(dir)) {
			const filePath = path.join(dir, name)
			const content = readFileIfExists(filePath)
			if (content === null || parsePresetLine(content) === null) continue
			atomicWriteFile(filePath, replacePresetLine(content, entries))
			updatedFiles.push(filePath)
		}
	}

	return { updatedFiles }
}

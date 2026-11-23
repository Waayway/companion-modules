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

function readInt(filePath: string): number | null {
	const raw = readFileIfExists(filePath)
	if (raw === null) return null
	const value = Number.parseInt(raw.trim(), 10)
	return Number.isFinite(value) ? value : null
}

/**
 * The device dir of the GPU to report: among the cards exposing device/gpu_busy_percent
 * (connector subdirs like card0-DP-1 are skipped), the one with the most dedicated VRAM
 * (device/mem_info_vram_total). With an AMD CPU's integrated GPU next to a discrete card the
 * iGPU is usually card0 with a small carve-out, so "first card" would read the wrong GPU.
 * Ties (or no VRAM info) keep the lowest card number.
 */
export function findGpuDeviceDir(sysfsRoot: string): string | null {
	const drmRoot = path.join(sysfsRoot, DRM_CLASS_DIR)
	let entries: string[]
	try {
		entries = fs.readdirSync(drmRoot)
	} catch {
		return null
	}

	const cards = entries
		.filter((name) => CARD_DIR_PATTERN.test(name))
		.sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))

	let best: { dir: string; vram: number } | null = null
	for (const card of cards) {
		const dir = path.join(drmRoot, card, 'device')
		if (readFileIfExists(path.join(dir, 'gpu_busy_percent')) === null) continue
		const vram = readInt(path.join(dir, 'mem_info_vram_total')) ?? 0
		if (best === null || vram > best.vram) best = { dir, vram }
	}
	return best?.dir ?? null
}

/** device/gpu_busy_percent of the GPU findGpuDeviceDir picks. */
export function findGpuBusyPercentPath(sysfsRoot: string): string | null {
	const dir = findGpuDeviceDir(sysfsRoot)
	return dir === null ? null : path.join(dir, 'gpu_busy_percent')
}

export function readGpuBusyPercent(sysfsRoot: string): number | null {
	const busyPath = findGpuBusyPercentPath(sysfsRoot)
	return busyPath === null ? null : readInt(busyPath)
}

/** The GPU's own hwmon dir (device/hwmon/hwmonN), so temperature and load come from the same card. */
export function findGpuHwmonDir(sysfsRoot: string): string | null {
	const dir = findGpuDeviceDir(sysfsRoot)
	if (dir === null) return null
	try {
		const hwmon = fs
			.readdirSync(path.join(dir, 'hwmon'))
			.filter((name) => /^hwmon\d+$/.test(name))
			.sort()[0]
		return hwmon ? path.join(dir, 'hwmon', hwmon) : null
	} catch {
		return null
	}
}

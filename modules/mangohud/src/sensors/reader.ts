import { findHwmonDirByName, readTemp1InputCelsius } from './hwmon.js'
import { findGpuHwmonDir, readGpuBusyPercent } from './gpu.js'

const CPU_HWMON_NAMES = ['k10temp', 'zenpower']
const GPU_HWMON_NAMES = ['amdgpu']

export interface SensorReadings {
	cpuTemp: number | null
	gpuTemp: number | null
	gpuLoad: number | null
}

/**
 * AMD-only, per the common brief: CPU temp from k10temp/zenpower; GPU load and temp from the
 * same card (the one with the most VRAM, see gpu.ts), its temp from that card's own hwmon.
 * Falls back to the first hwmon named amdgpu when the card has no hwmon link.
 */
export function readSensors(sysfsRoot: string): SensorReadings {
	const cpuHwmonDir = findHwmonDirByName(sysfsRoot, CPU_HWMON_NAMES)
	const gpuHwmonDir = findGpuHwmonDir(sysfsRoot) ?? findHwmonDirByName(sysfsRoot, GPU_HWMON_NAMES)
	return {
		cpuTemp: cpuHwmonDir ? readTemp1InputCelsius(cpuHwmonDir) : null,
		gpuTemp: gpuHwmonDir ? readTemp1InputCelsius(gpuHwmonDir) : null,
		gpuLoad: readGpuBusyPercent(sysfsRoot),
	}
}

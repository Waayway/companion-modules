import { findHwmonDirByName, readTemp1InputCelsius } from './hwmon.js'
import { readGpuBusyPercent } from './gpu.js'

const CPU_HWMON_NAMES = ['k10temp', 'zenpower']
const GPU_HWMON_NAMES = ['amdgpu']

export interface SensorReadings {
	cpuTemp: number | null
	gpuTemp: number | null
	gpuLoad: number | null
}

/** AMD-only, per the common brief: CPU temp from k10temp/zenpower, GPU temp and load from amdgpu. */
export function readSensors(sysfsRoot: string): SensorReadings {
	const cpuHwmonDir = findHwmonDirByName(sysfsRoot, CPU_HWMON_NAMES)
	const gpuHwmonDir = findHwmonDirByName(sysfsRoot, GPU_HWMON_NAMES)
	return {
		cpuTemp: cpuHwmonDir ? readTemp1InputCelsius(cpuHwmonDir) : null,
		gpuTemp: gpuHwmonDir ? readTemp1InputCelsius(gpuHwmonDir) : null,
		gpuLoad: readGpuBusyPercent(sysfsRoot),
	}
}

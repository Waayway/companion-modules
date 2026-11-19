import { readSensors, type SensorReadings } from './reader.js'

const MIN_POLL_MS = 500
const SENSOR_KEYS = ['cpu_temp', 'gpu_temp', 'gpu_load'] as const
type SensorVariable = (typeof SENSOR_KEYS)[number]

export interface SensorsManagerHost {
	setVariableValues(values: Partial<Record<SensorVariable, string>>): void
	checkFeedbacks(feedbackType: string, ...feedbackTypes: string[]): void
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

export interface SensorsManagerOptions {
	sysfsRoot: string
	pollMs: number
}

function formatValue(value: number | null): string {
	return value === null ? '-' : String(value)
}

/**
 * Polls CPU/GPU temp and GPU load from sysfs on a single timer and only pushes variables that
 * changed since the last poll. A missing sensor reads "-" and never logs: only an unexpected read
 * error (not a missing file) logs a warning.
 */
export class SensorsManager {
	private sysfsRoot = '/sys'
	private pollMs = 2000
	private timer: NodeJS.Timeout | null = null
	private lastPushed: Partial<Record<SensorVariable, string>> = {}
	private current: SensorReadings = { cpuTemp: null, gpuTemp: null, gpuLoad: null }

	constructor(
		private readonly host: SensorsManagerHost,
		private readonly readSensorsImpl: (sysfsRoot: string) => SensorReadings = readSensors,
	) {}

	configure(options: SensorsManagerOptions): void {
		this.stop()
		this.sysfsRoot = options.sysfsRoot
		this.pollMs = Math.max(MIN_POLL_MS, options.pollMs)
		this.poll()
		this.timer = setInterval(() => this.poll(), this.pollMs)
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = null
	}

	poll(): void {
		let readings: SensorReadings
		try {
			readings = this.readSensorsImpl(this.sysfsRoot)
		} catch (err) {
			this.host.log('warn', `Failed to read sensors from ${this.sysfsRoot}: ${(err as Error).message}`)
			return
		}
		this.current = readings

		const next: Record<SensorVariable, string> = {
			cpu_temp: formatValue(readings.cpuTemp),
			gpu_temp: formatValue(readings.gpuTemp),
			gpu_load: formatValue(readings.gpuLoad),
		}
		const changed: Partial<Record<SensorVariable, string>> = {}
		for (const key of SENSOR_KEYS) {
			if (this.lastPushed[key] !== next[key]) changed[key] = next[key]
		}
		if (Object.keys(changed).length > 0) {
			this.lastPushed = next
			this.host.setVariableValues(changed)
			if ('cpu_temp' in changed || 'gpu_temp' in changed) {
				this.host.checkFeedbacks('cpu_temp_above', 'gpu_temp_above')
			}
		}
	}

	getCpuTemp(): number | null {
		return this.current.cpuTemp
	}

	getGpuTemp(): number | null {
		return this.current.gpuTemp
	}
}

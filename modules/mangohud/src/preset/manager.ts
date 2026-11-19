import { entriesForPreset, nextPreset, parseCycleOrder } from './cycle.js'
import { labelForPreset, parsePresetLabels } from './labels.js'
import { applyPresetToDir, readActivePresetEntries } from './files.js'
import { watchConfigDir } from './watch.js'

export interface PresetManagerHost {
	setVariableValues(values: Partial<Record<'preset' | 'preset_name', string>>): void
	checkFeedbacks(feedbackType: string, ...feedbackTypes: string[]): void
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

export interface PresetManagerOptions {
	configDir: string
	cycleOrder: string
	presetLabels: string
	updatePerAppConfigs: boolean
}

/** Owns the MangoHud preset config state: current entries, watcher, cycle order and labels. */
export class PresetManager {
	private configDir = ''
	private cycleOrder: number[] = []
	private labels: Record<number, string> = {}
	private updatePerAppConfigs = true
	private currentEntries: number[] | null = null
	private stopWatching: (() => void) | null = null

	constructor(private readonly host: PresetManagerHost) {}

	configure(options: PresetManagerOptions): void {
		this.stop()
		this.configDir = options.configDir
		this.cycleOrder = parseCycleOrder(options.cycleOrder)
		this.labels = parsePresetLabels(options.presetLabels)
		this.updatePerAppConfigs = options.updatePerAppConfigs
		this.stopWatching = watchConfigDir(this.configDir, () => this.refresh())
		this.refresh()
	}

	stop(): void {
		this.stopWatching?.()
		this.stopWatching = null
	}

	refresh(): void {
		let entries: number[] | null
		try {
			entries = readActivePresetEntries(this.configDir)
		} catch (err) {
			this.host.log('warn', `Failed to read MangoHud preset from ${this.configDir}: ${(err as Error).message}`)
			entries = null
		}
		this.setCurrentEntries(entries)
	}

	getCurrentPreset(): number | null {
		return this.currentEntries && this.currentEntries.length > 0 ? this.currentEntries[0] : null
	}

	setPreset(preset: number): void {
		this.write(entriesForPreset(preset, this.cycleOrder))
	}

	cyclePreset(): void {
		const next = nextPreset(this.getCurrentPreset(), this.cycleOrder)
		this.write(entriesForPreset(next, this.cycleOrder))
	}

	private write(entries: number[]): void {
		try {
			applyPresetToDir(this.configDir, entries, this.updatePerAppConfigs)
		} catch (err) {
			this.host.log('error', `Failed to write MangoHud preset to ${this.configDir}: ${(err as Error).message}`)
			return
		}
		this.setCurrentEntries(entries)
	}

	private setCurrentEntries(entries: number[] | null): void {
		this.currentEntries = entries
		const current = this.getCurrentPreset()
		this.host.setVariableValues({
			preset: current === null ? '?' : String(current),
			preset_name: labelForPreset(this.labels, current),
		})
		this.host.checkFeedbacks('preset_is')
	}
}

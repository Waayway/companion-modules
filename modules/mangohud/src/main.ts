import os from 'node:os'
import path from 'node:path'
import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { PresetManager } from './preset/manager.js'
import { ControlClient } from './control/client.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()
	readonly presets = new PresetManager(this)
	readonly control = new ControlClient(this)

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.applyConfig()

		this.updateStatus(InstanceStatus.Ok)

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export Presets
		this.updateVariableDefinitions() // export variable definitions
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.presets.stop()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.applyConfig()
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	private applyConfig(): void {
		const configDir = this.config.configDir?.trim()
			? this.config.configDir.trim()
			: path.join(os.homedir(), '.config', 'MangoHud')

		this.presets.configure({
			configDir,
			cycleOrder: this.config.cycleOrder ?? '',
			presetLabels: this.config.presetLabels ?? '',
			updatePerAppConfigs: this.config.updatePerAppConfigs,
		})
		this.control.configure(this.config.controlSocket?.trim() || 'mangohud')
	}
}

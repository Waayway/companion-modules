import path from 'node:path'
import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdatePresets } from './presets.js'
import { ButtonBoxClient } from './client.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: Record<string, never>
	variables: Record<string, never>
}

export { UpgradeScripts }

export function resolveSocketPath(configured: string | undefined, runtimeDir: string | undefined): string {
	const trimmed = configured?.trim()
	if (trimmed) return trimmed
	return path.join(runtimeDir || `/run/user/${process.getuid?.() ?? 1000}`, 'companion-buttonbox.sock')
}

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	client: ButtonBoxClient | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		UpdateActions(this)
		UpdatePresets(this)
		this.connect(config)
	}

	async destroy(): Promise<void> {
		this.client?.destroy()
		this.client = undefined
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.connect(config)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private connect(config: ModuleConfig): void {
		this.client?.destroy()
		const socketPath = resolveSocketPath(config.socketPath, process.env.XDG_RUNTIME_DIR)
		this.client = new ButtonBoxClient(socketPath, (connected) =>
			this.updateStatus(connected ? InstanceStatus.Ok : InstanceStatus.Disconnected),
		)
		this.client.start()
	}
}

import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import type { MessageBus } from '@particle/dbus-next'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, UpdateVariableValues, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { connectWithRetry, resolveBusAddress, type BusConnection } from './mpris/bus.js'
import { MprisTracker, type TrackerSnapshot } from './mpris/tracker.js'
import type { PlayerConnection } from './mpris/player.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

const EMPTY_SNAPSHOT: TrackerSnapshot = { players: [], selected: null }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Setup in init()

	private busConnection: BusConnection | null = null
	private tracker: MprisTracker | null = null
	private snapshot: TrackerSnapshot = EMPTY_SNAPSHOT
	/** Set by the "select player" action; takes priority over the `player` config field until cleared. */
	private playerOverride: string | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export Presets
		this.updateVariableDefinitions() // export variable definitions
		this.updateVariableValues(EMPTY_SNAPSHOT)

		this.connect()
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.disconnect()
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.disconnect()
		this.connect()
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

	updateVariableValues(snapshot: TrackerSnapshot): void {
		UpdateVariableValues(this, snapshot)
	}

	/** The latest tracker snapshot, for feedbacks to read. */
	getSnapshot(): TrackerSnapshot {
		return this.snapshot
	}

	/** The D-Bus connection for the currently selected player, for actions to call methods on. */
	getSelectedPlayerConnection(): PlayerConnection | null {
		return this.tracker?.getSelectedConnection() ?? null
	}

	/** Sets or clears (`null`) the runtime player override set by the "select player" action. */
	setPlayerOverride(player: string | null): void {
		this.playerOverride = player
		this.tracker?.refresh()
	}

	// Connects (with retry/backoff on failure) without awaiting, per the module runtime contract: init()
	// must not block on the bus being reachable, status reporting does that job instead.
	private connect(): void {
		let address: string
		try {
			address = resolveBusAddress(this.config.busAddress, process.env.XDG_RUNTIME_DIR)
		} catch (err) {
			this.updateStatus(InstanceStatus.ConnectionFailure, errorMessage(err))
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.busConnection = connectWithRetry({
			address,
			onConnected: (bus) => this.handleConnected(bus),
			onFailure: (err) => this.handleConnectionFailure(err),
		})
	}

	private disconnect(): void {
		this.busConnection?.destroy()
		this.busConnection = null
		this.tracker?.destroy()
		this.tracker = null
	}

	private handleConnected(bus: MessageBus): void {
		this.updateStatus(InstanceStatus.Ok)

		const tracker = new MprisTracker(bus, {
			getConfiguredPlayer: () => this.playerOverride ?? this.config.player ?? 'auto',
			onUpdate: (snapshot) => this.handleSnapshot(snapshot),
		})
		this.tracker = tracker
		tracker.start().catch((err: unknown) => {
			this.log('error', `Failed to start MPRIS tracking: ${errorMessage(err)}`)
		})
	}

	private handleConnectionFailure(err: unknown): void {
		this.tracker?.destroy()
		this.tracker = null
		this.handleSnapshot(EMPTY_SNAPSHOT)
		this.updateStatus(InstanceStatus.ConnectionFailure, errorMessage(err))
	}

	private handleSnapshot(snapshot: TrackerSnapshot): void {
		this.snapshot = snapshot
		this.updateVariableValues(snapshot)
		this.checkAllFeedbacks()
	}
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}

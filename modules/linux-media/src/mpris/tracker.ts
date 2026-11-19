import type { MessageBus } from '@particle/dbus-next'
import { isMprisPlayerName, listMprisPlayerNames, watchNameOwnerChanges } from './names.js'
import {
	applyPropertyChanges,
	buildPlayerStateFromProperties,
	connectToPlayer,
	DEFAULT_PLAYER_SETUP_RETRY,
	fetchPlayerProperties,
	MPRIS_PLAYER_INTERFACE,
	playerSetupRetryDelaysMs,
	type PlayerConnection,
	type PlayerSetupRetryOptions,
	type PlayerState,
} from './player.js'
import { selectPlayer } from './selector.js'

const DBUS_BUS_NAME = 'org.freedesktop.DBus'
const DBUS_OBJECT_PATH = '/org/freedesktop/DBus'
const DEFAULT_POSITION_POLL_MS = 1000

export type TrackerSnapshot = {
	players: PlayerState[]
	selected: PlayerState | null
}

export type TrackerOptions = {
	getConfiguredPlayer: () => string
	onUpdate: (snapshot: TrackerSnapshot) => void
	positionPollMs?: number
	now?: () => number
	playerSetupRetry?: PlayerSetupRetryOptions
	/** Called at debug level, e.g. when a player's setup is retried and ultimately given up on. */
	log?: (message: string) => void
}

type TrackedPlayer = {
	state: PlayerState
	connection: PlayerConnection
	onPropertiesChanged: (iface: string, changed: Record<string, unknown>) => void
}

type PendingSetup = {
	cancelled: boolean
}

async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Tracks every MPRIS player on a connected bus and reports the aggregated, selected state on every change. */
export class MprisTracker {
	private readonly bus: MessageBus
	private readonly getConfiguredPlayer: () => string
	private readonly onUpdate: (snapshot: TrackerSnapshot) => void
	private readonly positionPollMs: number
	private readonly now: () => number
	private readonly playerSetupRetry: PlayerSetupRetryOptions
	private readonly log: (message: string) => void
	private readonly players = new Map<string, TrackedPlayer>()
	private readonly pendingSetups = new Map<string, PendingSetup>()
	private unwatchNameOwnerChanges: (() => void) | null = null
	private positionTimer: ReturnType<typeof setInterval> | null = null
	private destroyed = false

	constructor(bus: MessageBus, options: TrackerOptions) {
		this.bus = bus
		this.getConfiguredPlayer = options.getConfiguredPlayer
		this.onUpdate = options.onUpdate
		this.positionPollMs = options.positionPollMs ?? DEFAULT_POSITION_POLL_MS
		this.now = options.now ?? Date.now
		this.playerSetupRetry = options.playerSetupRetry ?? DEFAULT_PLAYER_SETUP_RETRY
		this.log = options.log ?? (() => {})
	}

	async start(): Promise<void> {
		const dbusObject = await this.bus.getProxyObject(DBUS_BUS_NAME, DBUS_OBJECT_PATH)
		const dbusInterface = dbusObject.getInterface(DBUS_BUS_NAME)

		this.unwatchNameOwnerChanges = watchNameOwnerChanges(dbusInterface, (change) => {
			if (this.destroyed) return
			if (change.newOwner === '') {
				this.removePlayer(change.name)
			} else if (change.oldOwner === '') {
				void this.addPlayer(change.name)
			}
		})

		const names = await listMprisPlayerNames(dbusInterface)
		await Promise.all(names.map(async (name) => this.addPlayer(name)))
	}

	getSnapshot(): TrackerSnapshot {
		const players = Array.from(this.players.values()).map((entry) => entry.state)
		const selected = selectPlayer(players, this.getConfiguredPlayer())
		return { players, selected }
	}

	/** The D-Bus connection for the currently selected player, for actions to call methods on. */
	getSelectedConnection(): PlayerConnection | null {
		const selected = this.getSnapshot().selected
		if (!selected) return null
		return this.players.get(selected.busName)?.connection ?? null
	}

	/** Forces the selection to be recomputed and reported, e.g. after the configured player changes. */
	refresh(): void {
		this.emitUpdate()
	}

	destroy(): void {
		this.destroyed = true
		if (this.positionTimer) {
			clearInterval(this.positionTimer)
			this.positionTimer = null
		}
		this.unwatchNameOwnerChanges?.()
		this.unwatchNameOwnerChanges = null
		for (const pending of this.pendingSetups.values()) {
			pending.cancelled = true
		}
		this.pendingSetups.clear()
		for (const name of Array.from(this.players.keys())) {
			this.removePlayer(name)
		}
	}

	/**
	 * A player can `RequestName` before it `export()`s its MPRIS object: `NameOwnerChanged` reaches this
	 * tracker as soon as the name change is committed, which can race ahead of the same player's own,
	 * separate `export()` call on its own connection. So the first connect/`GetAll` attempt right after a
	 * name appears can legitimately fail here and must be retried, rather than dropping the player for
	 * good on the first failure.
	 */
	private async addPlayer(busName: string): Promise<void> {
		if (!isMprisPlayerName(busName) || this.players.has(busName) || this.pendingSetups.has(busName)) return
		if (this.destroyed) return

		const pending: PendingSetup = { cancelled: false }
		this.pendingSetups.set(busName, pending)
		const delaysMs = playerSetupRetryDelaysMs(this.playerSetupRetry)
		let lastError: unknown

		try {
			for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
				if (pending.cancelled || this.destroyed) return
				try {
					const connection = await connectToPlayer(this.bus, busName)
					const properties = await fetchPlayerProperties(connection)
					if (pending.cancelled || this.destroyed || this.players.has(busName)) return

					const state = buildPlayerStateFromProperties(busName, properties, this.now())
					const onPropertiesChanged = (iface: string, changed: Record<string, unknown>): void => {
						if (iface !== MPRIS_PLAYER_INTERFACE) return
						const entry = this.players.get(busName)
						if (!entry) return
						entry.state = applyPropertyChanges(entry.state, changed, this.now())
						this.emitUpdate()
					}
					connection.properties.on('PropertiesChanged', onPropertiesChanged)
					this.players.set(busName, { state, connection, onPropertiesChanged })
					this.emitUpdate()
					return
				} catch (err) {
					lastError = err
					const delayMs = delaysMs[attempt]
					if (delayMs === undefined) break
					await delay(delayMs)
				}
			}
			if (!pending.cancelled && !this.destroyed) {
				const reason = lastError instanceof Error ? lastError.message : String(lastError)
				this.log(`giving up on player setup for ${busName} after ${delaysMs.length + 1} attempts: ${reason}`)
			}
		} finally {
			this.pendingSetups.delete(busName)
		}
	}

	private removePlayer(busName: string): void {
		const pending = this.pendingSetups.get(busName)
		if (pending) pending.cancelled = true
		const entry = this.players.get(busName)
		if (!entry) return
		entry.connection.properties.off('PropertiesChanged', entry.onPropertiesChanged)
		this.players.delete(busName)
		this.emitUpdate()
	}

	private emitUpdate(): void {
		if (this.destroyed) return
		const snapshot = this.getSnapshot()
		this.refreshPositionTimer(snapshot.selected)
		this.onUpdate(snapshot)
	}

	private refreshPositionTimer(selected: PlayerState | null): void {
		const shouldPoll = selected !== null && selected.playbackStatus === 'Playing'
		if (shouldPoll && !this.positionTimer) {
			this.positionTimer = setInterval(() => void this.pollPosition(), this.positionPollMs)
		} else if (!shouldPoll && this.positionTimer) {
			clearInterval(this.positionTimer)
			this.positionTimer = null
		}
	}

	private async pollPosition(): Promise<void> {
		const selected = this.getSnapshot().selected
		if (!selected) return
		const entry = this.players.get(selected.busName)
		if (!entry) return
		try {
			const value = await entry.connection.properties.Get(MPRIS_PLAYER_INTERFACE, 'Position')
			entry.state = applyPropertyChanges(entry.state, { Position: value }, this.now())
			this.emitUpdate()
		} catch {
			// Transient read failure: the next tick retries.
		}
	}
}

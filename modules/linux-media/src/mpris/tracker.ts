import type { MessageBus } from '@particle/dbus-next'
import { isMprisPlayerName, listMprisPlayerNames, watchNameOwnerChanges } from './names.js'
import {
	applyPropertyChanges,
	buildPlayerStateFromProperties,
	connectToPlayer,
	fetchPlayerProperties,
	MPRIS_PLAYER_INTERFACE,
	type PlayerConnection,
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
}

type TrackedPlayer = {
	state: PlayerState
	connection: PlayerConnection
	onPropertiesChanged: (iface: string, changed: Record<string, unknown>) => void
}

/** Tracks every MPRIS player on a connected bus and reports the aggregated, selected state on every change. */
export class MprisTracker {
	private readonly bus: MessageBus
	private readonly getConfiguredPlayer: () => string
	private readonly onUpdate: (snapshot: TrackerSnapshot) => void
	private readonly positionPollMs: number
	private readonly now: () => number
	private readonly players = new Map<string, TrackedPlayer>()
	private unwatchNameOwnerChanges: (() => void) | null = null
	private positionTimer: ReturnType<typeof setInterval> | null = null
	private destroyed = false

	constructor(bus: MessageBus, options: TrackerOptions) {
		this.bus = bus
		this.getConfiguredPlayer = options.getConfiguredPlayer
		this.onUpdate = options.onUpdate
		this.positionPollMs = options.positionPollMs ?? DEFAULT_POSITION_POLL_MS
		this.now = options.now ?? Date.now
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
		for (const name of Array.from(this.players.keys())) {
			this.removePlayer(name)
		}
	}

	private async addPlayer(busName: string): Promise<void> {
		if (!isMprisPlayerName(busName) || this.players.has(busName) || this.destroyed) return
		try {
			const connection = await connectToPlayer(this.bus, busName)
			const properties = await fetchPlayerProperties(connection)
			if (this.destroyed || this.players.has(busName)) return

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
		} catch {
			// The player vanished mid-setup, or exposes a broken MPRIS interface: ignore and move on.
		}
	}

	private removePlayer(busName: string): void {
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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import dbus from '@particle/dbus-next'
import type { MessageBus } from '@particle/dbus-next'
import type { LogLevel } from '@companion-module/base'
import { startFakePlayer, type FakePlayer } from '../mpris/fixtures/fakePlayer.js'
import { MprisTracker } from '../mpris/tracker.js'
import type { PlayerConnection } from '../mpris/player.js'
import type { ActionModuleContext } from './helpers.js'
import { TransportActions } from './transport.js'
import { ShuffleActions } from './shuffle.js'
import { LoopActions } from './loop.js'
import { VolumeActions } from './volume.js'
import { SeekActions } from './seek.js'
import { SelectPlayerActions } from './selectPlayer.js'

const hasDbusSession = typeof process.env.DBUS_SESSION_BUS_ADDRESS === 'string'
const skipReason = 'dbus-run-session is not available; skipping D-Bus integration test'

async function connect(address: string): Promise<MessageBus> {
	const bus = dbus.sessionBus({ busAddress: address })
	await once(bus, 'connect')
	return bus
}

async function waitFor(predicate: () => boolean, description: string, timeoutMs = 10_000): Promise<void> {
	const start = Date.now()
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timed out waiting for: ${description}`)
		}
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
}

/** A minimal, directly-typed stand-in for ModuleInstance: just the surface the action definitions use. */
class FakeModule implements ActionModuleContext {
	readonly tracker: MprisTracker
	playerOverride: string | null = null
	logs: { level: LogLevel; message: string }[] = []

	constructor(tracker: MprisTracker) {
		this.tracker = tracker
	}

	getSelectedPlayerConnection(): PlayerConnection | null {
		return this.tracker.getSelectedConnection()
	}

	setPlayerOverride(player: string | null): void {
		this.playerOverride = player
		this.tracker.refresh()
	}

	log(level: LogLevel, message: string): void {
		this.logs.push({ level, message })
	}
}

/** Builds a `FakeModule` wired to a real `MprisTracker` on `clientBus`, following its own override. */
function createFakeModule(clientBus: MessageBus): FakeModule {
	// eslint-disable-next-line prefer-const -- assigned once, after the closure below that captures it is created
	let self: FakeModule
	const tracker = new MprisTracker(clientBus, {
		getConfiguredPlayer: () => self.playerOverride ?? 'auto',
		onUpdate: () => {},
	})
	self = new FakeModule(tracker)
	return self
}

/** Invokes an action's callback by id, bypassing the `false | undefined` possibility in the definition map. */
async function invokeAction(
	definitions: Record<string, unknown>,
	id: string,
	options: Record<string, unknown>,
): Promise<void> {
	const definition = definitions[id] as { callback: (event: unknown, context: unknown) => unknown } | undefined
	if (!definition) throw new Error(`no such action definition: ${id}`)
	await definition.callback({ options }, {})
}

async function withTracker(
	run: (self: FakeModule, bus: MessageBus, fakePlayer: FakePlayer) => Promise<void>,
): Promise<void> {
	const address = process.env.DBUS_SESSION_BUS_ADDRESS as string
	const playerBus = await connect(address)
	const clientBus = await connect(address)
	const fakePlayer = await startFakePlayer(playerBus, `actiontest${Math.random().toString(36).slice(2)}`)
	const self = createFakeModule(clientBus)

	try {
		await self.tracker.start()
		await waitFor(() => self.tracker.getSnapshot().players.length === 1, 'the fake player to be discovered')
		await run(self, clientBus, fakePlayer)
	} finally {
		self.tracker.destroy()
		await fakePlayer.disconnect()
		clientBus.disconnect()
		playerBus.disconnect()
	}
}

void test(
	'transport actions call the matching D-Bus method on the selected player',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		await withTracker(async (self, _bus, fakePlayer) => {
			const actions = TransportActions(self)
			await invokeAction(actions, 'play', {})
			assert.equal(fakePlayer.interface.playCalls, 1)
			await invokeAction(actions, 'pause', {})
			assert.equal(fakePlayer.interface.pauseCalls, 1)
			await invokeAction(actions, 'playpause', {})
			assert.equal(fakePlayer.interface.playPauseCalls, 1)
			await invokeAction(actions, 'next', {})
			assert.equal(fakePlayer.interface.nextCalls, 1)
			await invokeAction(actions, 'previous', {})
			assert.equal(fakePlayer.interface.previousCalls, 1)
			await invokeAction(actions, 'stop', {})
			assert.equal(fakePlayer.interface.stopCalls, 1)
		})
	},
)

void test(
	'transport actions do nothing but log at debug level when no player is selected',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		await withTracker(async (self, _bus, fakePlayer) => {
			self.setPlayerOverride('no-such-player')
			await waitFor(() => self.tracker.getSnapshot().selected === null, 'the selection to become empty')
			const actions = TransportActions(self)
			await invokeAction(actions, 'play', {})
			assert.equal(fakePlayer.interface.playCalls, 0)
			assert.ok(self.logs.some((entry) => entry.level === 'debug' && entry.message.includes('no player selected')))
		})
	},
)

void test('shuffle action toggles, forces on and forces off', { skip: !hasDbusSession && skipReason }, async () => {
	await withTracker(async (self, _bus, fakePlayer) => {
		const actions = ShuffleActions(self)
		assert.equal(fakePlayer.interface.shuffle, false)
		await invokeAction(actions, 'shuffle', { mode: 'toggle' })
		assert.equal(fakePlayer.interface.shuffle, true)
		await invokeAction(actions, 'shuffle', { mode: 'off' })
		assert.equal(fakePlayer.interface.shuffle, false)
		await invokeAction(actions, 'shuffle', { mode: 'on' })
		assert.equal(fakePlayer.interface.shuffle, true)
	})
})

void test('loop action cycles and sets a chosen mode', { skip: !hasDbusSession && skipReason }, async () => {
	await withTracker(async (self, _bus, fakePlayer) => {
		const actions = LoopActions(self)
		assert.equal(fakePlayer.interface.loopStatus, 'None')
		await invokeAction(actions, 'loop', { mode: 'cycle' })
		assert.equal(fakePlayer.interface.loopStatus, 'Playlist')
		await invokeAction(actions, 'loop', { mode: 'cycle' })
		assert.equal(fakePlayer.interface.loopStatus, 'Track')
		await invokeAction(actions, 'loop', { mode: 'None' })
		assert.equal(fakePlayer.interface.loopStatus, 'None')
	})
})

void test(
	'volume actions step up/down and set, clamped to 0-100',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		await withTracker(async (self, _bus, fakePlayer) => {
			fakePlayer.interface.volume = 0.5
			const actions = VolumeActions(self)
			await invokeAction(actions, 'volume_up', { step: 5 })
			assert.equal(fakePlayer.interface.volume, 0.55)
			await invokeAction(actions, 'volume_down', { step: 20 })
			assert.equal(fakePlayer.interface.volume, 0.35)
			await invokeAction(actions, 'volume_set', { value: 150 })
			assert.equal(fakePlayer.interface.volume, 1, 'an out-of-range set must be clamped to 100%')
		})
	},
)

void test(
	'volume actions on a player that rejects volume control do not throw and log a warning',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		const address = process.env.DBUS_SESSION_BUS_ADDRESS as string
		const playerBus = await connect(address)
		const clientBus = await connect(address)
		const fakePlayer = await startFakePlayer(playerBus, 'novolume', { volumeControllable: false })
		const self = createFakeModule(clientBus)
		try {
			await self.tracker.start()
			await waitFor(() => self.tracker.getSnapshot().players.length === 1, 'the fake player to be discovered')
			const actions = VolumeActions(self)
			await assert.doesNotReject(invokeAction(actions, 'volume_up', { step: 5 }))
			assert.ok(self.logs.some((entry) => entry.level === 'warn' && entry.message.includes('volume up failed')))
		} finally {
			self.tracker.destroy()
			await fakePlayer.disconnect()
			clientBus.disconnect()
			playerBus.disconnect()
		}
	},
)

void test(
	'seek action calls Seek with the offset in microseconds',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		await withTracker(async (self, _bus, fakePlayer) => {
			const actions = SeekActions(self)
			await invokeAction(actions, 'seek', { seconds: 10 })
			assert.deepEqual(fakePlayer.interface.seekCalls, [10_000_000n])
			await invokeAction(actions, 'seek', { seconds: -3 })
			assert.deepEqual(fakePlayer.interface.seekCalls, [10_000_000n, -3_000_000n])
		})
	},
)

void test(
	'select player sets an override that pins the selection, and "auto" clears it',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		const address = process.env.DBUS_SESSION_BUS_ADDRESS as string
		const alphaBus = await connect(address)
		const betaBus = await connect(address)
		const clientBus = await connect(address)
		const self = createFakeModule(clientBus)
		try {
			const alpha = await startFakePlayer(alphaBus, 'alphaselect', { playbackStatus: 'Playing' })
			const beta = await startFakePlayer(betaBus, 'betaselect', { playbackStatus: 'Paused' })
			await self.tracker.start()
			await waitFor(() => self.tracker.getSnapshot().players.length === 2, 'both fake players to be discovered')
			assert.equal(self.tracker.getSnapshot().selected?.busName, alpha.busName, 'auto must prefer the playing one')

			const actions = SelectPlayerActions(self)
			await invokeAction(actions, 'select_player', { player: 'betaselect' })
			assert.equal(self.tracker.getSnapshot().selected?.busName, beta.busName)

			await invokeAction(actions, 'select_player', { player: 'auto' })
			assert.equal(self.tracker.getSnapshot().selected?.busName, alpha.busName, 'auto must take over again')

			await alpha.disconnect()
			await beta.disconnect()
		} finally {
			self.tracker.destroy()
			clientBus.disconnect()
			alphaBus.disconnect()
			betaBus.disconnect()
		}
	},
)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import dbus from '@particle/dbus-next'
import type { MessageBus } from '@particle/dbus-next'
import { startFakePlayer } from './fixtures/fakePlayer.js'
import { MprisTracker, type TrackerSnapshot } from './tracker.js'
import { buildVariableValues } from '../variables.js'

const hasDbusSession = typeof process.env.DBUS_SESSION_BUS_ADDRESS === 'string'
const skipReason = 'dbus-run-session is not available; skipping D-Bus integration test'

async function connect(address: string): Promise<MessageBus> {
	const bus = dbus.sessionBus({ busAddress: address })
	await once(bus, 'connect')
	return bus
}

async function waitFor(predicate: () => boolean, description: string, timeoutMs = 3000): Promise<void> {
	const start = Date.now()
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timed out waiting for: ${description}`)
		}
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
}

void test(
	'the tracker follows player state, resolves auto across two players, and drops a vanished one',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		const address = process.env.DBUS_SESSION_BUS_ADDRESS as string
		// Each fake player gets its own connection: a dbus-next service object is keyed by
		// (connection, path), so two distinct players cannot share one connection, just like
		// two real MPRIS players are always two separate processes.
		const alphaBus = await connect(address)
		const betaBus = await connect(address)
		const clientBus = await connect(address)

		const updates: TrackerSnapshot[] = []
		const tracker = new MprisTracker(clientBus, {
			getConfiguredPlayer: () => 'auto',
			onUpdate: (snapshot) => updates.push(snapshot),
			positionPollMs: 50,
		})

		try {
			const alpha = await startFakePlayer(alphaBus, 'alpha', {
				playbackStatus: 'Paused',
				title: 'Alpha Song',
				artist: ['Alpha Artist'],
				volume: 0.4,
			})

			await tracker.start()

			// A single paused player is still selected: auto falls back to it when nothing is playing.
			assert.equal(updates.length >= 1, true, 'starting with one existing player must emit at least one update')
			let latest = updates[updates.length - 1]
			assert.equal(latest.players.length, 1)
			assert.equal(latest.selected?.busName, alpha.busName)
			assert.deepEqual(
				{ status: buildVariableValues(latest).status, title: buildVariableValues(latest).title },
				{ status: 'Paused', title: 'Alpha Song' },
			)

			// A second, playing player appears: auto must prefer it over the paused one.
			const beta = await startFakePlayer(betaBus, 'beta', { playbackStatus: 'Playing', title: 'Beta Song' })
			await waitFor(() => tracker.getSnapshot().players.length === 2, 'beta to be discovered')
			latest = updates[updates.length - 1]
			assert.equal(latest.players.length, 2)
			assert.equal(latest.selected?.busName, beta.busName, 'auto must prefer the playing player')

			// Both playing: the one most recently touched (alpha, just now) wins the tie-break.
			alpha.interface.setPlaybackStatus('Playing')
			await waitFor(
				() => tracker.getSnapshot().selected?.busName === alpha.busName,
				'alpha to become selected after becoming the most recently active playing player',
			)
			assert.equal(buildVariableValues(tracker.getSnapshot()).status, 'Playing')

			// A metadata change on the selected player must flow through to variable values.
			alpha.interface.setTitle('Alpha Song (Live)')
			await waitFor(
				() => tracker.getSnapshot().selected?.metadata.title === 'Alpha Song (Live)',
				'the title change to be observed',
			)

			// beta vanishes: it must be dropped, and the player count must reflect that.
			await beta.disconnect()
			await waitFor(() => tracker.getSnapshot().players.length === 1, 'beta to be dropped after vanishing')
			latest = tracker.getSnapshot()
			assert.equal(latest.players.length, 1)
			assert.equal(latest.players[0]?.busName, alpha.busName)
			assert.equal(buildVariableValues(latest).players, 1)

			await alpha.disconnect()
		} finally {
			tracker.destroy()
			clientBus.disconnect()
			alphaBus.disconnect()
			betaBus.disconnect()
		}
	},
)

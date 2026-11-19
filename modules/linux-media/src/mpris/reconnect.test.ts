import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import dbus from '@particle/dbus-next'
import type { MessageBus } from '@particle/dbus-next'
import { connectWithRetry } from './bus.js'
import { MprisTracker } from './tracker.js'
import { startFakePlayer } from './fixtures/fakePlayer.js'

const dbusDaemonAvailable = spawnSync('dbus-daemon', ['--version']).error === undefined
const skipReason = 'dbus-daemon is not available; skipping D-Bus reconnect integration test'

async function waitFor(predicate: () => boolean, description: string, timeoutMs = 10_000): Promise<void> {
	const start = Date.now()
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timed out waiting for: ${description}`)
		}
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
}

function startDaemon(socketPath: string): ChildProcess {
	return spawn('dbus-daemon', ['--session', '--nofork', `--address=unix:path=${socketPath}`], {
		stdio: ['ignore', 'pipe', 'pipe'],
	})
}

async function killAndWait(daemon: ChildProcess): Promise<void> {
	daemon.kill('SIGKILL')
	await once(daemon, 'exit')
}

void test(
	'connectWithRetry detects a daemon dying without an error event, and reconnects once it is back',
	{ skip: !dbusDaemonAvailable && skipReason },
	async () => {
		const tmpDir = mkdtempSync(path.join(tmpdir(), 'linux-media-reconnect-'))
		const socketPath = path.join(tmpDir, 'bus-socket')
		const address = `unix:path=${socketPath}`

		let daemon = startDaemon(socketPath)
		let connectedCount = 0
		let failedCount = 0
		// A plain mutable box, not a reassigned `let`: TS's assertion-narrowing of a `let` doesn't survive
		// across the async callbacks below reassigning it, so a boxed field keeps every read honest.
		const trackerBox: { current: MprisTracker | null } = { current: null }

		const busConnection = connectWithRetry({
			address,
			backoff: { initialDelayMs: 50, maxDelayMs: 150 },
			onConnected: (bus: MessageBus) => {
				connectedCount += 1
				trackerBox.current = new MprisTracker(bus, { getConfiguredPlayer: () => 'auto', onUpdate: () => {} })
				trackerBox.current.start().catch(() => {})
			},
			onFailure: () => {
				failedCount += 1
				trackerBox.current?.destroy()
				trackerBox.current = null
			},
		})

		let playerBus: MessageBus | undefined
		try {
			await waitFor(() => connectedCount >= 1, 'the initial connection to succeed')

			await killAndWait(daemon)
			// dbus-daemon leaves the socket file behind on SIGKILL; a second daemon cannot bind it otherwise.
			rmSync(socketPath, { force: true })

			// >=1, not ===1: once the socket is gone, every retry attempt fails too (ENOENT/ECONNREFUSED),
			// so failedCount keeps climbing. What matters is that it moved at all, proving the dropped
			// connection itself was detected (the end-event fix) rather than just a retry hitting the socket.
			await waitFor(
				() => failedCount >= 1,
				'connectWithRetry to report the connection failure (proves the end-event fix works, not just error)',
			)
			assert.equal(trackerBox.current, null, 'the tracker must be torn down on failure, not left dangling')

			const connectedBeforeRestart = connectedCount
			daemon = startDaemon(socketPath)
			await waitFor(() => connectedCount > connectedBeforeRestart, 'a reconnect once the daemon is back')
			assert.ok(trackerBox.current, 'a fresh tracker must be rebuilt after reconnecting')

			playerBus = await (async () => {
				const bus = dbus.sessionBus({ busAddress: address })
				await once(bus, 'connect')
				return bus
			})()
			const fakePlayer = await startFakePlayer(playerBus, 'reconnecttest')
			await waitFor(
				() => trackerBox.current?.getSnapshot().players.length === 1,
				'the rebuilt tracker to discover a player again',
			)
			await fakePlayer.disconnect()
		} finally {
			trackerBox.current?.destroy()
			busConnection.destroy()
			playerBus?.disconnect()
			daemon.kill('SIGKILL')
			rmSync(tmpDir, { recursive: true, force: true })
		}
	},
)

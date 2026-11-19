import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dbus from '@particle/dbus-next'
import type { MessageBus } from '@particle/dbus-next'
import { startFakePlayer } from './mpris/fixtures/fakePlayer.js'

const hasDbusSession = typeof process.env.DBUS_SESSION_BUS_ADDRESS === 'string'
const skipReason = 'dbus-run-session is not available; skipping D-Bus integration test'

const moduleDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const childScript = path.join(moduleDir, 'dist', 'mpris', 'fixtures', 'permissionCheckChild.js')

async function connect(address: string): Promise<MessageBus> {
	const bus = dbus.sessionBus({ busAddress: address })
	await once(bus, 'connect')
	return bus
}

void test(
	'the bus client reads metadata and calls PlayPause under --permission --allow-net --allow-fs-read=<module dir>',
	{ skip: !hasDbusSession && skipReason },
	async () => {
		const address = process.env.DBUS_SESSION_BUS_ADDRESS as string
		const bus = await connect(address)
		const fakePlayer = await startFakePlayer(bus, 'permissioncheck', { title: 'Permission Check Song' })

		try {
			const child = spawn(
				process.execPath,
				['--permission', '--allow-net', `--allow-fs-read=${moduleDir}`, childScript, address, fakePlayer.busName],
				{ stdio: ['ignore', 'pipe', 'pipe'] },
			)
			let stdout = ''
			let stderr = ''
			child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
			child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
			const [exitCode] = await once(child, 'exit')

			assert.equal(exitCode, 0, `child process failed under the restricted permission set; stderr:\n${stderr}`)
			const result = JSON.parse(stdout.trim()) as { ok: boolean; propertyNames: string[] }
			assert.equal(result.ok, true)
			assert.ok(result.propertyNames.includes('Metadata'), 'child must have read Metadata via GetAll')
			assert.equal(fakePlayer.interface.playPauseCalls, 1, 'child must have called PlayPause on the real player')
		} finally {
			await fakePlayer.disconnect()
			bus.disconnect()
		}
	},
)

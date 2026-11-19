import dbus from '@particle/dbus-next'
import { connectToPlayer, fetchPlayerProperties } from '../player.js'

/**
 * Run under Companion's real permission flags (`node --permission --allow-net
 * --allow-fs-read=<module dir>`) by permission.test.ts, to prove the empty `{}` manifest
 * permission set is enough for the bus client to read metadata and call a Player method.
 */
async function main(): Promise<void> {
	const [address, busName] = process.argv.slice(2)
	if (!address || !busName) {
		throw new Error('usage: permissionCheckChild.js <busAddress> <busName>')
	}

	const bus = dbus.sessionBus({ busAddress: address })
	await new Promise<void>((resolve, reject) => {
		bus.once('connect', () => resolve())
		bus.once('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))))
	})

	const connection = await connectToPlayer(bus, busName)
	const properties = await fetchPlayerProperties(connection)
	await connection.player.PlayPause()
	bus.disconnect()

	process.stdout.write(`${JSON.stringify({ ok: true, propertyNames: Object.keys(properties) })}\n`)
}

main().catch((err: unknown) => {
	process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
	process.exitCode = 1
})

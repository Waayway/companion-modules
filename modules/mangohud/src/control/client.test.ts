import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { randomBytes } from 'node:crypto'
import { ControlClient, type ControlClientHost } from './client.js'

const HANDSHAKE = ':MangoHudControlVersion=1;:DeviceName=fake;:MangoHudVersion=0.8;'

function makeFakeHost(): ControlClientHost & { variables: Record<string, string>; logs: [string, string][] } {
	const variables: Record<string, string> = {}
	const logs: [string, string][] = []
	return {
		variables,
		logs,
		setVariableValues(values) {
			for (const [key, value] of Object.entries(values)) {
				if (value !== undefined) variables[key] = value
			}
		},
		log(level, message) {
			logs.push([level, message])
		},
	}
}

function startFakeServer(
	t: import('node:test').TestContext,
	handshake = HANDSHAKE,
): { socketName: string; received: Promise<string> } {
	const socketName = `mangohud-client-test-${process.pid}-${randomBytes(4).toString('hex')}`
	let resolveReceived: (value: string) => void
	const received = new Promise<string>((resolve) => {
		resolveReceived = resolve
	})
	const server = net.createServer((socket) => {
		socket.write(handshake)
		const chunks: Buffer[] = []
		socket.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
		socket.on('end', () => resolveReceived(Buffer.concat(chunks).toString('utf8')))
	})
	server.listen('\0' + socketName)
	t.after(() => server.close())
	return { socketName, received }
}

test('ControlClient.toggleHud sends :hud; and records the MangoHud version from the handshake', async (t) => {
	const { socketName, received } = startFakeServer(t)
	const host = makeFakeHost()
	const client = new ControlClient(host)
	client.configure(socketName)

	await client.toggleHud()

	assert.equal(await received, ':hud;')
	assert.equal(host.variables.mangohud_version, '0.8')
})

test('ControlClient.setLogging sends the start/stop/toggle bytes', async (t) => {
	const host = makeFakeHost()
	const client = new ControlClient(host)

	const start = startFakeServer(t)
	client.configure(start.socketName)
	await client.setLogging(1)
	assert.equal(await start.received, ':logging=1;')

	const stop = startFakeServer(t)
	client.configure(stop.socketName)
	await client.setLogging(0)
	assert.equal(await stop.received, ':logging=0;')

	const toggle = startFakeServer(t)
	client.configure(toggle.socketName)
	await client.setLogging()
	assert.equal(await toggle.received, ':logging;')
})

test('ControlClient.toggleFcat sends :fcat;', async (t) => {
	const { socketName, received } = startFakeServer(t)
	const host = makeFakeHost()
	const client = new ControlClient(host)
	client.configure(socketName)

	await client.toggleFcat()

	assert.equal(await received, ':fcat;')
})

test('ControlClient logs a clear hint instead of throwing when the socket is missing', async () => {
	const host = makeFakeHost()
	const client = new ControlClient(host)
	client.configure(`mangohud-client-test-nobody-${process.pid}`)

	await client.toggleHud()

	assert.equal(host.logs.length, 1)
	assert.equal(host.logs[0][0], 'warn')
	assert.match(host.logs[0][1], /control=mangohud-client-test-nobody/)
})

test('ControlClient.isReachable reflects whether the socket accepts a connection', async (t) => {
	const { socketName } = startFakeServer(t)
	const host = makeFakeHost()
	const client = new ControlClient(host)
	client.configure(socketName)

	assert.equal(await client.isReachable(), true)

	const unreachable = new ControlClient(makeFakeHost())
	unreachable.configure(`mangohud-client-test-nobody-${process.pid}`)
	assert.equal(await unreachable.isReachable(), false)
})

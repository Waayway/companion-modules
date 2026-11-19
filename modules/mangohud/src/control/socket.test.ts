import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { randomBytes } from 'node:crypto'
import { probeControlSocket, sendControlCommand } from './socket.js'

const HANDSHAKE = ':MangoHudControlVersion=1;:DeviceName=fake;:MangoHudVersion=0.8;'

function startFakeServer(t: import('node:test').TestContext): { socketName: string; received: Promise<string> } {
	const socketName = `mangohud-test-${process.pid}-${randomBytes(4).toString('hex')}`
	let resolveReceived: (value: string) => void
	const received = new Promise<string>((resolve) => {
		resolveReceived = resolve
	})

	const server = net.createServer((socket) => {
		socket.write(HANDSHAKE)
		const chunks: Buffer[] = []
		socket.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
		socket.on('end', () => resolveReceived(Buffer.concat(chunks).toString('utf8')))
	})
	server.listen('\0' + socketName)
	t.after(() => server.close())

	return { socketName, received }
}

test('sendControlCommand sends the exact bytes for :hud; and returns the handshake', async (t) => {
	const { socketName, received } = startFakeServer(t)
	const result = await sendControlCommand(socketName, ':hud;')
	assert.equal(result.handshake, HANDSHAKE)
	assert.equal(await received, ':hud;')
})

test('sendControlCommand sends the exact bytes for :logging=1;', async (t) => {
	const { socketName, received } = startFakeServer(t)
	await sendControlCommand(socketName, ':logging=1;')
	assert.equal(await received, ':logging=1;')
})

test('sendControlCommand sends the exact bytes for :logging=0;', async (t) => {
	const { socketName, received } = startFakeServer(t)
	await sendControlCommand(socketName, ':logging=0;')
	assert.equal(await received, ':logging=0;')
})

test('sendControlCommand sends the exact bytes for :logging; (toggle)', async (t) => {
	const { socketName, received } = startFakeServer(t)
	await sendControlCommand(socketName, ':logging;')
	assert.equal(await received, ':logging;')
})

test('sendControlCommand sends the exact bytes for :fcat;', async (t) => {
	const { socketName, received } = startFakeServer(t)
	await sendControlCommand(socketName, ':fcat;')
	assert.equal(await received, ':fcat;')
})

test('probeControlSocket sends zero bytes and still gets the handshake', async (t) => {
	const { socketName, received } = startFakeServer(t)
	const result = await probeControlSocket(socketName)
	assert.equal(result.handshake, HANDSHAKE)
	assert.equal(await received, '')
})

test('sendControlCommand rejects when nothing is listening on the socket', async () => {
	await assert.rejects(async () => sendControlCommand(`mangohud-test-nobody-${process.pid}`, ':hud;'))
})

test('sendControlCommand rejects when the server never sends a handshake', async (t) => {
	const socketName = `mangohud-test-silent-${process.pid}-${randomBytes(4).toString('hex')}`
	const server = net.createServer(() => {
		// never writes anything: the client should time out waiting for the handshake
	})
	server.listen('\0' + socketName)
	t.after(() => server.close())

	await assert.rejects(async () => sendControlCommand(socketName, ':hud;', 100), /Timed out/)
})

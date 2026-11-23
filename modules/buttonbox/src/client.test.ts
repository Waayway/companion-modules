import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { ButtonBoxClient } from './client.js'

function tmpSocket(): { dir: string; sock: string } {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-'))
	return { dir, sock: path.join(dir, 's.sock') }
}

async function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

async function until(cond: () => boolean, ms = 3000): Promise<void> {
	const end = Date.now() + ms
	while (!cond()) {
		if (Date.now() > end) throw new Error('timeout waiting for condition')
		await sleep(20)
	}
}

type Srv = { server: net.Server; received: () => string; ended: () => boolean; close: () => Promise<void> }

async function listen(sock: string): Promise<Srv> {
	let received = ''
	let ended = false
	const sockets = new Set<net.Socket>()
	const server = net.createServer((s) => {
		sockets.add(s)
		s.setEncoding('utf8')
		s.on('data', (d: string) => (received += d))
		s.on('end', () => (ended = true))
		s.on('error', () => {})
	})
	return new Promise((resolve) =>
		server.listen(sock, () =>
			resolve({
				server,
				received: () => received,
				ended: () => ended,
				close: async () =>
					new Promise<void>((r) => {
						for (const s of sockets) s.destroy()
						server.close(() => r())
					}),
			}),
		),
	)
}

test('sends down and up lines', async (t) => {
	const { dir, sock } = tmpSocket()
	const srv = await listen(sock)
	let connected = false
	const client = new ButtonBoxClient(sock, (c) => (connected = c))
	t.after(async () => {
		client.destroy()
		await srv.close()
		fs.rmSync(dir, { recursive: true, force: true })
	})
	client.start()
	await until(() => connected)
	client.send('down', 9)
	client.send('up', 9)
	await until(() => srv.received() === 'down 9\nup 9\n')
})

test('reports disconnected when no server, then connects', async (t) => {
	const { dir, sock } = tmpSocket()
	const statuses: boolean[] = []
	const client = new ButtonBoxClient(sock, (c) => statuses.push(c))
	const late: { srv?: Srv } = {}
	t.after(async () => {
		client.destroy()
		await late.srv?.close()
		fs.rmSync(dir, { recursive: true, force: true })
	})
	client.start()
	await sleep(100)
	assert.equal(statuses.at(-1), false)
	const srv = await listen(sock)
	late.srv = srv
	await until(() => statuses.at(-1) === true)
})

test('reconnects after server restart', async (t) => {
	const { dir, sock } = tmpSocket()
	let srv = await listen(sock)
	let connected = false
	const client = new ButtonBoxClient(sock, (c) => (connected = c))
	t.after(async () => {
		client.destroy()
		await srv.close()
		fs.rmSync(dir, { recursive: true, force: true })
	})
	client.start()
	await until(() => connected)
	await srv.close()
	await until(() => !connected)
	srv = await listen(sock)
	await until(() => connected)
	client.send('down', 1)
	await until(() => srv.received() === 'down 1\n')
})

test('drops sends while disconnected', async (t) => {
	const { dir, sock } = tmpSocket()
	let connected = false
	const client = new ButtonBoxClient(sock, (c) => (connected = c))
	const late: { srv?: Srv } = {}
	t.after(async () => {
		client.destroy()
		await late.srv?.close()
		fs.rmSync(dir, { recursive: true, force: true })
	})
	client.start()
	assert.doesNotThrow(() => client.send('down', 5))
	const srv = await listen(sock)
	late.srv = srv
	await until(() => connected)
	client.send('up', 2)
	await until(() => srv.received() === 'up 2\n')
	await sleep(100)
	assert.equal(srv.received(), 'up 2\n')
})

test('destroy closes the socket', async (t) => {
	const { dir, sock } = tmpSocket()
	const srv = await listen(sock)
	let connected = false
	const client = new ButtonBoxClient(sock, (c) => (connected = c))
	t.after(async () => {
		await srv.close()
		fs.rmSync(dir, { recursive: true, force: true })
	})
	client.start()
	await until(() => connected)
	client.destroy()
	await until(() => srv.ended())
})

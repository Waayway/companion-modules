import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { DBusError } from '@particle/dbus-next'
import { GamemodeClient, type GamemodeClientHost } from './client.js'

function makeHost(): { host: GamemodeClientHost; events: string[] } {
	const events: string[] = []
	const host: GamemodeClientHost = {
		setVariableValues: (values) => {
			if (values.gamemode) events.push(`var:${values.gamemode}`)
		},
		checkFeedbacks: (...types) => events.push(`feedback:${types.join(',')}`),
		log: (level, message) => events.push(`log:${level}:${message}`),
	}
	return { host, events }
}

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 6; i++) await Promise.resolve()
}

class FakeInterface extends EventEmitter {}

class FakePropertiesInterface extends FakeInterface {
	clientCount = 0
	async Get(): Promise<{ value: number }> {
		return { value: this.clientCount }
	}
}

class FakeProxyObject {
	readonly gameMode = new FakeInterface()
	readonly props = new FakePropertiesInterface()
	getInterface(name: string): FakeInterface {
		return name === 'org.freedesktop.DBus.Properties' ? this.props : this.gameMode
	}
}

class FakeBus extends EventEmitter {
	constructor(private readonly outcome: FakeProxyObject | Error) {
		super()
	}
	async getProxyObject(): Promise<FakeProxyObject> {
		if (this.outcome instanceof Error) throw this.outcome
		return this.outcome
	}
	disconnect(): void {}
}

function logLines(events: string[]): string[] {
	return events.filter((e) => e.startsWith('log:'))
}

test('configure() with no bus address does not connect and reports gamemode off', () => {
	const { host, events } = makeHost()
	let connectCalls = 0
	const client = new GamemodeClient(host, () => {
		connectCalls += 1
		return new FakeBus(new Error('should not be called')) as never
	})

	client.configure('')

	assert.equal(connectCalls, 0)
	assert.ok(events.includes('var:off'))
	assert.equal(logLines(events).length, 1)
	assert.match(logLines(events)[0], /^log:warn:/)
})

test('a ServiceUnknown error (gamemoded not running) logs once at info level, not as a warning', async () => {
	const { host, events } = makeHost()
	const err = new DBusError('org.freedesktop.DBus.Error.ServiceUnknown', 'no owner for name')
	const client = new GamemodeClient(host, () => new FakeBus(err) as never)

	client.configure('unix:path=/fake-bus')
	await flushMicrotasks()

	assert.ok(events.includes('var:off'))
	assert.equal(logLines(events).length, 1)
	assert.match(logLines(events)[0], /^log:info:/)

	client.stop()
})

test('a non-ServiceUnknown connection failure logs once as a warning and retries with doubling backoff', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] })
	const { host, events } = makeHost()
	let connectCalls = 0
	const client = new GamemodeClient(host, () => {
		connectCalls += 1
		return new FakeBus(new Error('ECONNREFUSED')) as never
	})

	client.configure('unix:path=/fake-bus')
	await flushMicrotasks()
	assert.equal(connectCalls, 1)
	assert.equal(logLines(events).length, 1)
	assert.match(logLines(events)[0], /^log:warn:/)

	t.mock.timers.tick(2000)
	await flushMicrotasks()
	assert.equal(connectCalls, 2, 'retries after the initial 2s backoff')

	t.mock.timers.tick(4000)
	await flushMicrotasks()
	assert.equal(connectCalls, 3, 'the next backoff doubles to 4s')

	// Still only the first failure of the streak was logged.
	assert.equal(logLines(events).length, 1)

	client.stop()
})

test('a successful connection reads ClientCount once, then follows signals and PropertiesChanged', async () => {
	const { host, events } = makeHost()
	const proxy = new FakeProxyObject()
	const client = new GamemodeClient(host, () => new FakeBus(proxy) as never)

	client.configure('unix:path=/fake-bus')
	await flushMicrotasks()
	assert.ok(events.includes('var:off'), events.join('|'))

	events.length = 0
	proxy.props.clientCount = 1
	proxy.gameMode.emit('GameRegistered', 10, '/com/feralinteractive/GameMode/Game0')
	await flushMicrotasks()
	assert.ok(events.includes('var:on'), events.join('|'))

	events.length = 0
	proxy.props.clientCount = 0
	proxy.gameMode.emit('GameUnregistered', 10, '/com/feralinteractive/GameMode/Game0')
	await flushMicrotasks()
	assert.ok(events.includes('var:off'), events.join('|'))

	events.length = 0
	proxy.props.emit('PropertiesChanged', 'com.feralinteractive.GameMode', { ClientCount: { value: 3 } })
	await flushMicrotasks()
	assert.ok(events.includes('var:on'), events.join('|'))

	events.length = 0
	proxy.props.emit('PropertiesChanged', 'some.other.interface', { Foo: { value: 1 } })
	await flushMicrotasks()
	assert.equal(events.length, 0, 'PropertiesChanged for an unrelated interface is ignored')

	client.stop()
})

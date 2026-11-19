import dbus from '@particle/dbus-next'
import { GamemodeClient, type GamemodeClientHost } from '../client.js'

const { Interface, ACCESS_READ } = dbus.interface

const SERVICE_NAME = 'com.feralinteractive.GameMode'
const OBJECT_PATH = '/com/feralinteractive/GameMode'

class FakeGameMode extends Interface {
	count = 0

	constructor() {
		super(SERVICE_NAME)
	}

	get ClientCount(): number {
		return this.count
	}

	GameRegistered(pid: number, requester: string): [number, string] {
		return [pid, requester]
	}

	GameUnregistered(pid: number, requester: string): [number, string] {
		return [pid, requester]
	}
}

FakeGameMode.configureMembers({
	properties: {
		ClientCount: { signature: 'i', access: ACCESS_READ },
	},
	signals: {
		GameRegistered: { signature: 'io' },
		GameUnregistered: { signature: 'io' },
	},
})

interface CheckResult {
	name: string
	pass: boolean
	detail: string
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
	const results: CheckResult[] = []
	const record = (name: string, pass: boolean, detail = ''): void => {
		results.push({ name, pass, detail })
	}

	const busAddress = process.env.DBUS_SESSION_BUS_ADDRESS
	if (!busAddress) {
		record('fixture has a private bus address', false, 'DBUS_SESSION_BUS_ADDRESS is not set')
		finish(results)
		return
	}

	const serviceBus = dbus.sessionBus({ busAddress })
	serviceBus.on('error', (err: Error) => record('service bus error', false, String(err)))
	await serviceBus.requestName(SERVICE_NAME)
	const service = new FakeGameMode()
	serviceBus.export(OBJECT_PATH, service)

	const events: string[] = []
	const host: GamemodeClientHost = {
		setVariableValues: (values) => {
			if (values.gamemode) events.push(`var:${values.gamemode}`)
		},
		checkFeedbacks: () => {
			events.push('feedback')
		},
		log: (level, message) => {
			events.push(`log:${level}:${message}`)
		},
	}
	const client = new GamemodeClient(host)
	client.configure(busAddress)

	await sleep(400)
	record('initial ClientCount=0 reports gamemode off', events.includes('var:off'), events.join('|'))

	events.length = 0
	service.count = 1
	service.GameRegistered(1234, '/com/feralinteractive/GameMode/Game0')
	await sleep(400)
	record('GameRegistered with ClientCount=1 flips gamemode on', events.includes('var:on'), events.join('|'))

	events.length = 0
	service.count = 0
	service.GameUnregistered(1234, '/com/feralinteractive/GameMode/Game0')
	await sleep(400)
	record('GameUnregistered with ClientCount=0 flips gamemode off', events.includes('var:off'), events.join('|'))

	events.length = 0
	service.count = 2
	Interface.emitPropertiesChanged(service, { ClientCount: 2 }, [])
	await sleep(400)
	record('PropertiesChanged with ClientCount=2 flips gamemode on', events.includes('var:on'), events.join('|'))

	client.stop()
	serviceBus.disconnect()
	finish(results)
}

function finish(results: CheckResult[]): void {
	console.log(JSON.stringify(results))
	process.exitCode = results.every((r) => r.pass) ? 0 : 1
}

main().catch((err: unknown) => {
	finish([
		{ name: 'fixture crashed', pass: false, detail: err instanceof Error ? (err.stack ?? err.message) : String(err) },
	])
})

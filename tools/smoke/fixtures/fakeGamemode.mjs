// Minimal `com.feralinteractive.GameMode` D-Bus service. Only exposes `ClientCount` plus a
// PropertiesChanged emission, which is the one signal modules/mangohud/src/gamemode/client.ts
// and its own fixture (gamemode-service.ts) both agree unambiguously flips the `gamemode`
// variable (the GameRegistered/GameUnregistered signal path in that fixture is not reusable as a
// library - see the smoke report for that finding - so this fake does not attempt it).
import dbus from '@particle/dbus-next'

const { Interface, ACCESS_READ } = dbus.interface

const SERVICE_NAME = 'com.feralinteractive.GameMode'
const OBJECT_PATH = '/com/feralinteractive/GameMode'

class FakeGameModeInterface extends Interface {
	constructor() {
		super(SERVICE_NAME)
		this.count = 0
	}

	get ClientCount() {
		return this.count
	}

	/** Test helper: push a ClientCount change as the real gamemoded would. */
	setClientCount(count) {
		this.count = count
		Interface.emitPropertiesChanged(this, { ClientCount: count }, [])
	}
}

FakeGameModeInterface.configureMembers({
	properties: {
		ClientCount: { signature: 'i', access: ACCESS_READ },
	},
})

export async function startFakeGamemodeService(busAddress) {
	const bus = dbus.sessionBus({ busAddress })
	await bus.requestName(SERVICE_NAME, 0)
	const iface = new FakeGameModeInterface()
	bus.export(OBJECT_PATH, iface)
	return {
		interface: iface,
		async disconnect() {
			bus.unexport(OBJECT_PATH, iface)
			await bus.releaseName(SERVICE_NAME)
			bus.disconnect()
		},
	}
}

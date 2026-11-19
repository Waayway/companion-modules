import dbus, { DBusError, type MessageBus, type ProxyObject, type Variant } from '@particle/dbus-next'

const SERVICE_NAME = 'com.feralinteractive.GameMode'
const OBJECT_PATH = '/com/feralinteractive/GameMode'
const PROPERTIES_INTERFACE = 'org.freedesktop.DBus.Properties'
const SERVICE_UNKNOWN_ERROR = 'org.freedesktop.DBus.Error.ServiceUnknown'
const INITIAL_RETRY_MS = 2000
const MAX_RETRY_MS = 60000

export interface GamemodeClientHost {
	setVariableValues(values: Partial<Record<'gamemode', string>>): void
	checkFeedbacks(feedbackType: string, ...feedbackTypes: string[]): void
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

type BusConnector = (options: { busAddress?: string }) => MessageBus

/**
 * Tracks gamemoded's ClientCount over D-Bus. One bus connection is kept open for as long as the
 * busAddress is configured; a dropped connection or a missing gamemoded retries with backoff, but
 * only logs the first failure of a streak so a long-absent gamemoded does not spam the log.
 */
export class GamemodeClient {
	private busAddress = ''
	private generation = 0
	private bus: MessageBus | null = null
	private retryDelayMs = INITIAL_RETRY_MS
	private retryTimer: NodeJS.Timeout | null = null
	private loggedFailure = false
	private active = false

	constructor(
		private readonly host: GamemodeClientHost,
		private readonly connectBus: BusConnector = dbus.sessionBus,
	) {}

	configure(busAddress: string): void {
		this.stop()
		this.busAddress = busAddress
		if (!this.busAddress) {
			this.host.log('warn', 'No D-Bus session bus address configured; "gamemode" will read off.')
			this.setActive(false)
			return
		}
		this.connect(this.generation)
	}

	stop(): void {
		this.generation += 1
		if (this.retryTimer) clearTimeout(this.retryTimer)
		this.retryTimer = null
		try {
			this.bus?.disconnect()
		} catch {
			// already disconnected
		}
		this.bus = null
		this.active = false
	}

	isActive(): boolean {
		return this.active
	}

	private connect(generation: number): void {
		let bus: MessageBus
		try {
			bus = this.connectBus({ busAddress: this.busAddress })
		} catch (err) {
			this.handleFailure(generation, err as Error)
			return
		}
		this.bus = bus
		bus.on('error', (err: Error) => this.handleFailure(generation, err))
		this.attachGameMode(bus, generation)
	}

	private attachGameMode(bus: MessageBus, generation: number): void {
		bus
			.getProxyObject(SERVICE_NAME, OBJECT_PATH)
			.then(async (obj) => {
				if (generation !== this.generation) return
				const gameModeIface = obj.getInterface(SERVICE_NAME)
				const propsIface = obj.getInterface(PROPERTIES_INTERFACE)

				gameModeIface.on('GameRegistered', () => void this.refreshClientCount(obj, generation))
				gameModeIface.on('GameUnregistered', () => void this.refreshClientCount(obj, generation))
				propsIface.on('PropertiesChanged', (iface: string, changed: Record<string, Variant>) => {
					if (generation !== this.generation || iface !== SERVICE_NAME) return
					const value = changed.ClientCount?.value
					if (typeof value === 'number') {
						this.setActive(value > 0)
					} else {
						void this.refreshClientCount(obj, generation)
					}
				})

				this.onConnected()
				await this.refreshClientCount(obj, generation)
			})
			.catch((err: Error) => this.handleFailure(generation, err))
	}

	private async refreshClientCount(obj: ProxyObject, generation: number): Promise<void> {
		try {
			const propsIface = obj.getInterface(PROPERTIES_INTERFACE)
			const variant = await propsIface.Get(SERVICE_NAME, 'ClientCount')
			if (generation !== this.generation) return
			this.setActive((variant?.value ?? 0) > 0)
		} catch (err) {
			if (generation !== this.generation) return
			this.handleFailure(generation, err as Error)
		}
	}

	private onConnected(): void {
		this.loggedFailure = false
		this.retryDelayMs = INITIAL_RETRY_MS
	}

	private handleFailure(generation: number, err: Error): void {
		if (generation !== this.generation) return
		this.setActive(false)
		const isServiceUnknown = err instanceof DBusError && err.type === SERVICE_UNKNOWN_ERROR
		if (!this.loggedFailure) {
			this.loggedFailure = true
			if (isServiceUnknown) {
				this.host.log(
					'info',
					`gamemoded is not registered on the D-Bus session bus (${SERVICE_NAME}); "gamemode" will read off until it starts.`,
				)
			} else {
				this.host.log('warn', `GameMode D-Bus connection failed: ${err.message}. Retrying in the background.`)
			}
		}
		this.scheduleRetry(generation)
	}

	private scheduleRetry(generation: number): void {
		if (this.retryTimer) clearTimeout(this.retryTimer)
		this.retryTimer = setTimeout(() => {
			this.retryTimer = null
			if (generation !== this.generation) return
			this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_MS)
			this.connect(generation)
		}, this.retryDelayMs)
	}

	private setActive(active: boolean): void {
		this.active = active
		this.host.setVariableValues({ gamemode: active ? 'on' : 'off' })
		this.host.checkFeedbacks('gamemode_active')
	}
}

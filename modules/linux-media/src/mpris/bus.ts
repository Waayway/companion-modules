import dbus from '@particle/dbus-next'
import type { MessageBus } from '@particle/dbus-next'

/**
 * Resolves the session bus address: the config override if set, else `unix:path=$XDG_RUNTIME_DIR/bus`.
 * Companion does not forward `DBUS_SESSION_BUS_ADDRESS` to modules, so that variable is never read here.
 */
export function resolveBusAddress(configuredAddress: string | undefined, xdgRuntimeDir: string | undefined): string {
	const trimmed = (configuredAddress ?? '').trim()
	if (trimmed !== '') return trimmed
	if (!xdgRuntimeDir) {
		throw new Error('No busAddress is configured and XDG_RUNTIME_DIR is not set')
	}
	return `unix:path=${xdgRuntimeDir}/bus`
}

export type BackoffOptions = {
	initialDelayMs: number
	maxDelayMs: number
}

export const DEFAULT_BACKOFF: BackoffOptions = {
	initialDelayMs: 1000,
	maxDelayMs: 30000,
}

/** Exponential backoff delay for the given retry attempt (0-based), capped at `maxDelayMs`. */
export function computeBackoffMs(attempt: number, options: BackoffOptions = DEFAULT_BACKOFF): number {
	const exponential = options.initialDelayMs * 2 ** Math.max(0, attempt)
	return Math.min(options.maxDelayMs, exponential)
}

export type BusConnectOptions = {
	address: string
	backoff?: BackoffOptions
	onConnected: (bus: MessageBus) => void
	onFailure: (error: unknown) => void
}

export type BusConnection = {
	destroy: () => void
}

/**
 * Connects to the bus, retrying with backoff on failure (unreachable socket, malformed address, or a
 * connection that later drops). Never throws: failures are reported through `onFailure`.
 */
export function connectWithRetry(options: BusConnectOptions): BusConnection {
	const backoff = options.backoff ?? DEFAULT_BACKOFF
	let attempt = 0
	let destroyed = false
	let retryTimer: ReturnType<typeof setTimeout> | null = null
	let currentBus: MessageBus | null = null

	const fail = (error: unknown): void => {
		if (destroyed) return
		currentBus = null
		options.onFailure(error)
		const delay = computeBackoffMs(attempt, backoff)
		attempt += 1
		retryTimer = setTimeout(attemptConnect, delay)
	}

	function attemptConnect(): void {
		if (destroyed) return
		let bus: MessageBus
		try {
			bus = dbus.sessionBus({ busAddress: options.address })
		} catch (error) {
			fail(error)
			return
		}

		const onInitialError = (error: unknown): void => fail(error)
		bus.once('error', onInitialError)
		bus.once('connect', () => {
			if (destroyed) {
				bus.disconnect()
				return
			}
			bus.removeListener('error', onInitialError)
			bus.on('error', (error: unknown) => fail(error))
			attempt = 0
			currentBus = bus
			options.onConnected(bus)
		})
	}

	attemptConnect()

	return {
		destroy: (): void => {
			destroyed = true
			if (retryTimer) {
				clearTimeout(retryTimer)
				retryTimer = null
			}
			currentBus?.disconnect()
			currentBus = null
		},
	}
}

import { probeControlSocket } from './socket.js'

export type ReachabilityChecker = (socketName: string) => Promise<boolean>
type Probe = (socketName: string, timeoutMs?: number) => Promise<unknown>

/** Lazily checks reachability with a cheap connect, cached for a few seconds so feedback redraws don't hammer the socket. */
export function createReachabilityChecker(
	probe: Probe = probeControlSocket,
	cacheMs = 5000,
	probeTimeoutMs = 300,
): ReachabilityChecker {
	let cache: { socketName: string; expires: number; value: boolean } | null = null
	let pending: Promise<boolean> | null = null

	return async function checkReachable(socketName: string): Promise<boolean> {
		const now = Date.now()
		if (cache && cache.socketName === socketName && cache.expires > now) {
			return cache.value
		}
		if (!pending) {
			pending = probe(socketName, probeTimeoutMs)
				.then(
					() => true,
					() => false,
				)
				.then((value) => {
					cache = { socketName, expires: Date.now() + cacheMs, value }
					pending = null
					return value
				})
		}
		return pending
	}
}

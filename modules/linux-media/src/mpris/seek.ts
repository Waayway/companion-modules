const MICROSECONDS_PER_SECOND = 1_000_000

/** Converts a relative seek offset in seconds to the microseconds `Seek` expects, as a bigint (D-Bus `x`). */
export function secondsToMicroseconds(seconds: number): bigint {
	return BigInt(Math.round(seconds * MICROSECONDS_PER_SECOND))
}

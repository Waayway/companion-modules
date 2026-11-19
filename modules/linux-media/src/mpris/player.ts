import type { ClientInterface, MessageBus } from '@particle/dbus-next'
import { EMPTY_METADATA, parseMetadata, type TrackMetadata } from './metadata.js'
import { unwrapVariant } from './variant.js'

export const MPRIS_OBJECT_PATH = '/org/mpris/MediaPlayer2'
export const MPRIS_PLAYER_INTERFACE = 'org.mpris.MediaPlayer2.Player'
export const DBUS_PROPERTIES_INTERFACE = 'org.freedesktop.DBus.Properties'

export type PlayerConnection = {
	busName: string
	properties: ClientInterface
	player: ClientInterface
}

/** Opens a proxy to a player's `/org/mpris/MediaPlayer2` object. Throws if the player does not expose it. */
export async function connectToPlayer(bus: MessageBus, busName: string): Promise<PlayerConnection> {
	const object = await bus.getProxyObject(busName, MPRIS_OBJECT_PATH)
	return {
		busName,
		properties: object.getInterface(DBUS_PROPERTIES_INTERFACE),
		player: object.getInterface(MPRIS_PLAYER_INTERFACE),
	}
}

/** Fetches every `Player` property in one call, for the initial snapshot of a newly seen player. */
export async function fetchPlayerProperties(connection: PlayerConnection): Promise<Record<string, unknown>> {
	return connection.properties.GetAll(MPRIS_PLAYER_INTERFACE)
}

export type PlayerSetupRetryOptions = {
	/** Total number of attempts, including the first (immediate) one. */
	attempts: number
	/** Delay before the second attempt; doubles for each attempt after that. */
	initialDelayMs: number
}

/**
 * A player can acquire its well-known bus name (`RequestName`) before it exports its MPRIS
 * object: the `NameOwnerChanged` signal reaches other connections as soon as the name change is
 * committed, which can race ahead of the same player's own, separate `export()` call. So the
 * first connect/`GetAll` attempt right after a name appears can legitimately fail, and must be
 * retried rather than treated as "not a real MPRIS player" on the first try.
 */
export const DEFAULT_PLAYER_SETUP_RETRY: PlayerSetupRetryOptions = {
	attempts: 5,
	initialDelayMs: 100,
}

/** The delay before each retry attempt after the first, doubling each time (e.g. [100, 200, 400, 800]). */
export function playerSetupRetryDelaysMs(options: PlayerSetupRetryOptions = DEFAULT_PLAYER_SETUP_RETRY): number[] {
	const delays: number[] = []
	for (let attempt = 0; attempt < options.attempts - 1; attempt++) {
		delays.push(options.initialDelayMs * 2 ** attempt)
	}
	return delays
}

export type PlayerState = {
	busName: string
	playbackStatus: string
	metadata: TrackMetadata
	volume: number | null
	shuffle: boolean | null
	loopStatus: string | null
	positionMicroseconds: number | null
	lastActiveAt: number
}

function asPlaybackStatus(value: unknown, fallback: string): string {
	const unwrapped = unwrapVariant(value)
	return typeof unwrapped === 'string' && unwrapped.length > 0 ? unwrapped : fallback
}

function asVolume(value: unknown, fallback: number | null): number | null {
	const unwrapped = unwrapVariant(value)
	return typeof unwrapped === 'number' && Number.isFinite(unwrapped) ? unwrapped : fallback
}

function asShuffle(value: unknown, fallback: boolean | null): boolean | null {
	const unwrapped = unwrapVariant(value)
	return typeof unwrapped === 'boolean' ? unwrapped : fallback
}

function asLoopStatus(value: unknown, fallback: string | null): string | null {
	const unwrapped = unwrapVariant(value)
	return typeof unwrapped === 'string' && unwrapped.length > 0 ? unwrapped : fallback
}

function asPosition(value: unknown, fallback: number | null): number | null {
	const unwrapped = unwrapVariant(value)
	if (typeof unwrapped === 'bigint') return Number(unwrapped)
	if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) return unwrapped
	return fallback
}

/** The state of a player that has just appeared, before any properties are known. */
export function createInitialPlayerState(busName: string, now: number): PlayerState {
	return {
		busName,
		playbackStatus: 'Stopped',
		metadata: EMPTY_METADATA,
		volume: null,
		shuffle: null,
		loopStatus: null,
		positionMicroseconds: null,
		lastActiveAt: now,
	}
}

/**
 * Pure reducer merging a set of changed `Player` properties (from `GetAll` or `PropertiesChanged`) into state.
 * Properties absent from `changed` keep their previous value, so players that omit a property are tolerated.
 */
export function applyPropertyChanges(
	previous: PlayerState,
	changed: Record<string, unknown>,
	now: number,
): PlayerState {
	const next: PlayerState = { ...previous, lastActiveAt: now }
	if ('PlaybackStatus' in changed)
		next.playbackStatus = asPlaybackStatus(changed.PlaybackStatus, previous.playbackStatus)
	if ('Metadata' in changed) next.metadata = parseMetadata(changed.Metadata)
	if ('Volume' in changed) next.volume = asVolume(changed.Volume, previous.volume)
	if ('Shuffle' in changed) next.shuffle = asShuffle(changed.Shuffle, previous.shuffle)
	if ('LoopStatus' in changed) next.loopStatus = asLoopStatus(changed.LoopStatus, previous.loopStatus)
	if ('Position' in changed) next.positionMicroseconds = asPosition(changed.Position, previous.positionMicroseconds)
	return next
}

/** Builds the state of a newly seen player from its initial `GetAll` snapshot. */
export function buildPlayerStateFromProperties(
	busName: string,
	properties: Record<string, unknown>,
	now: number,
): PlayerState {
	return applyPropertyChanges(createInitialPlayerState(busName, now), properties, now)
}

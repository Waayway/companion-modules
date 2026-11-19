import { unwrapVariant } from './variant.js'

export type TrackMetadata = {
	title: string | null
	artist: string | null
	album: string | null
	lengthMicroseconds: number | null
	artUrl: string | null
}

export const EMPTY_METADATA: TrackMetadata = {
	title: null,
	artist: null,
	album: null,
	lengthMicroseconds: null,
	artUrl: null,
}

function asString(value: unknown): string | null {
	const unwrapped = unwrapVariant(value)
	return typeof unwrapped === 'string' && unwrapped.length > 0 ? unwrapped : null
}

function asArtist(value: unknown): string | null {
	const unwrapped = unwrapVariant(value)
	if (!Array.isArray(unwrapped)) return null
	const names = unwrapped.filter((item): item is string => typeof item === 'string' && item.length > 0)
	return names.length > 0 ? names.join(', ') : null
}

function asMicroseconds(value: unknown): number | null {
	const unwrapped = unwrapVariant(value)
	if (typeof unwrapped === 'bigint') return Number(unwrapped)
	if (typeof unwrapped === 'number' && Number.isFinite(unwrapped)) return unwrapped
	return null
}

/** Parses an MPRIS `Player.Metadata` dict (`a{sv}`), tolerating missing or malformed fields. */
export function parseMetadata(rawMetadata: unknown): TrackMetadata {
	const unwrapped = unwrapVariant(rawMetadata)
	const dict = typeof unwrapped === 'object' && unwrapped !== null ? (unwrapped as Record<string, unknown>) : {}
	return {
		title: asString(dict['xesam:title']),
		artist: asArtist(dict['xesam:artist']),
		album: asString(dict['xesam:album']),
		lengthMicroseconds: asMicroseconds(dict['mpris:length']),
		artUrl: asString(dict['mpris:artUrl']),
	}
}

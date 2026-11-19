export const MPRIS_NAME_PREFIX = 'org.mpris.MediaPlayer2.'

export type PlayerSnapshot = {
	busName: string
	playbackStatus: string
	lastActiveAt: number
}

/** Strips the `org.mpris.MediaPlayer2.` prefix from a bus name, e.g. for display or config matching. */
export function getMprisNameSuffix(busName: string): string {
	return busName.startsWith(MPRIS_NAME_PREFIX) ? busName.slice(MPRIS_NAME_PREFIX.length) : busName
}

/** True when `configuredPlayer` names this bus name, matching the suffix exactly or as an instance of it (`mpv.instance123`). */
export function matchesConfiguredPlayer(busName: string, configuredPlayer: string): boolean {
	const wanted = configuredPlayer.trim().toLowerCase()
	if (wanted === '') return false
	const suffix = getMprisNameSuffix(busName).toLowerCase()
	return suffix === wanted || suffix.startsWith(`${wanted}.`)
}

function mostRecentlyActive<T extends PlayerSnapshot>(players: T[]): T | null {
	if (players.length === 0) return null
	return players.reduce((best, candidate) => (candidate.lastActiveAt > best.lastActiveAt ? candidate : best))
}

/**
 * `auto` picks a playing player, else the most recently active one, else the first.
 * A specific configured player only ever matches by name; it never falls back to `auto` behaviour.
 */
export function selectPlayer<T extends PlayerSnapshot>(players: T[], configuredPlayer: string): T | null {
	if (players.length === 0) return null

	const trimmed = configuredPlayer.trim()
	if (trimmed !== '' && trimmed.toLowerCase() !== 'auto') {
		return players.find((player) => matchesConfiguredPlayer(player.busName, trimmed)) ?? null
	}

	const playing = players.filter((player) => player.playbackStatus === 'Playing')
	return mostRecentlyActive(playing.length > 0 ? playing : players)
}

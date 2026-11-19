import type ModuleInstance from './main.js'
import type { TrackerSnapshot } from './mpris/tracker.js'
import { getMprisNameSuffix } from './mpris/selector.js'

export type VariablesSchema = {
	status: string
	player: string
	artist: string
	title: string
	album: string
	volume: number | string
	shuffle: string
	loop: string
	position: number
	length: number
	players: number
}

const MICROSECONDS_PER_SECOND = 1_000_000

function toSeconds(microseconds: number | null): number {
	return microseconds === null ? 0 : Math.max(0, Math.floor(microseconds / MICROSECONDS_PER_SECOND))
}

function toVolumePercent(volume: number | null): number | string {
	if (volume === null) return '-'
	return Math.max(0, Math.min(100, Math.round(volume * 100)))
}

/** Pure mapping from tracker state to variable values, so the "nothing playing" defaults can be unit tested. */
export function buildVariableValues(snapshot: TrackerSnapshot): VariablesSchema {
	const selected = snapshot.selected
	if (!selected) {
		return {
			status: 'Stopped',
			player: '-',
			artist: '-',
			title: 'Nothing playing',
			album: '-',
			volume: '-',
			shuffle: 'off',
			loop: 'None',
			position: 0,
			length: 0,
			players: snapshot.players.length,
		}
	}

	return {
		status: selected.playbackStatus,
		player: getMprisNameSuffix(selected.busName),
		artist: selected.metadata.artist ?? '-',
		title: selected.metadata.title ?? 'Nothing playing',
		album: selected.metadata.album ?? '-',
		volume: toVolumePercent(selected.volume),
		shuffle: selected.shuffle ? 'on' : 'off',
		loop: selected.loopStatus ?? 'None',
		position: toSeconds(selected.positionMicroseconds),
		length: toSeconds(selected.metadata.lengthMicroseconds),
		players: snapshot.players.length,
	}
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		status: { name: 'Playback status' },
		player: { name: 'Selected player' },
		artist: { name: 'Artist' },
		title: { name: 'Title' },
		album: { name: 'Album' },
		volume: { name: 'Volume (%)' },
		shuffle: { name: 'Shuffle' },
		loop: { name: 'Loop mode' },
		position: { name: 'Position (s)' },
		length: { name: 'Length (s)' },
		players: { name: 'Players detected' },
	})
}

export function UpdateVariableValues(self: ModuleInstance, snapshot: TrackerSnapshot): void {
	self.setVariableValues(buildVariableValues(snapshot))
}

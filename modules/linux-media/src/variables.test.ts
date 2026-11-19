import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVariableValues } from './variables.js'
import { createInitialPlayerState, applyPropertyChanges } from './mpris/player.js'
import type { TrackerSnapshot } from './mpris/tracker.js'

void test('buildVariableValues applies the "nothing playing" defaults when nothing is selected', () => {
	const snapshot: TrackerSnapshot = { players: [], selected: null }
	assert.deepEqual(buildVariableValues(snapshot), {
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
		players: 0,
	})
})

void test('buildVariableValues reports the players count even when none is selected', () => {
	const untracked = createInitialPlayerState('org.mpris.MediaPlayer2.mpv', 0)
	const snapshot: TrackerSnapshot = { players: [untracked], selected: null }
	assert.equal(buildVariableValues(snapshot).players, 1)
})

void test('buildVariableValues maps a fully populated selected player', () => {
	const state = applyPropertyChanges(
		createInitialPlayerState('org.mpris.MediaPlayer2.spotify', 0),
		{
			PlaybackStatus: 'Playing',
			Volume: 0.65,
			Shuffle: true,
			LoopStatus: 'Track',
			Position: 90_000_000,
			Metadata: {
				'xesam:title': 'Song Title',
				'xesam:artist': ['Artist Name'],
				'xesam:album': 'Album Name',
				'mpris:length': 210_000_000,
			},
		},
		0,
	)
	const snapshot: TrackerSnapshot = { players: [state], selected: state }
	assert.deepEqual(buildVariableValues(snapshot), {
		status: 'Playing',
		player: 'spotify',
		artist: 'Artist Name',
		title: 'Song Title',
		album: 'Album Name',
		volume: 65,
		shuffle: 'on',
		loop: 'Track',
		position: 90,
		length: 210,
		players: 1,
	})
})

void test('buildVariableValues does not truncate a long title', () => {
	const longTitle = 'A'.repeat(300)
	const state = applyPropertyChanges(
		createInitialPlayerState('org.mpris.MediaPlayer2.mpv', 0),
		{ Metadata: { 'xesam:title': longTitle } },
		0,
	)
	const snapshot: TrackerSnapshot = { players: [state], selected: state }
	assert.equal(buildVariableValues(snapshot).title, longTitle)
})

void test('buildVariableValues falls back to "-" for a selected player with unknown volume', () => {
	const state = createInitialPlayerState('org.mpris.MediaPlayer2.mpv', 0)
	const snapshot: TrackerSnapshot = { players: [state], selected: state }
	assert.equal(buildVariableValues(snapshot).volume, '-')
})

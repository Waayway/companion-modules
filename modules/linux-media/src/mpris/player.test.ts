import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPropertyChanges, buildPlayerStateFromProperties, createInitialPlayerState } from './player.js'

void test('createInitialPlayerState defaults to a stopped, empty player', () => {
	const state = createInitialPlayerState('org.mpris.MediaPlayer2.mpv', 1000)
	assert.equal(state.busName, 'org.mpris.MediaPlayer2.mpv')
	assert.equal(state.playbackStatus, 'Stopped')
	assert.equal(state.volume, null)
	assert.equal(state.shuffle, null)
	assert.equal(state.loopStatus, null)
	assert.equal(state.positionMicroseconds, null)
	assert.deepEqual(state.metadata, { title: null, artist: null, album: null, lengthMicroseconds: null, artUrl: null })
	assert.equal(state.lastActiveAt, 1000)
})

void test('buildPlayerStateFromProperties maps a full GetAll snapshot', () => {
	const state = buildPlayerStateFromProperties(
		'org.mpris.MediaPlayer2.mpv',
		{
			PlaybackStatus: { signature: 's', value: 'Playing' },
			Volume: { signature: 'd', value: 0.75 },
			Shuffle: { signature: 'b', value: true },
			LoopStatus: { signature: 's', value: 'Track' },
			Position: { signature: 'x', value: 1_500_000n },
			Metadata: {
				signature: 'a{sv}',
				value: {
					'xesam:title': { signature: 's', value: 'Fake Song' },
					'xesam:artist': { signature: 'as', value: ['Fake Artist'] },
				},
			},
		},
		2000,
	)
	assert.equal(state.playbackStatus, 'Playing')
	assert.equal(state.volume, 0.75)
	assert.equal(state.shuffle, true)
	assert.equal(state.loopStatus, 'Track')
	assert.equal(state.positionMicroseconds, 1_500_000)
	assert.equal(state.metadata.title, 'Fake Song')
	assert.equal(state.metadata.artist, 'Fake Artist')
	assert.equal(state.lastActiveAt, 2000)
})

void test('applyPropertyChanges only overwrites the properties present in the change set', () => {
	const initial = buildPlayerStateFromProperties(
		'org.mpris.MediaPlayer2.mpv',
		{ PlaybackStatus: 'Paused', Volume: 0.5 },
		1000,
	)
	const next = applyPropertyChanges(initial, { PlaybackStatus: 'Playing' }, 2000)
	assert.equal(next.playbackStatus, 'Playing')
	assert.equal(next.volume, 0.5, 'Volume must be unchanged since it was not in the change set')
	assert.equal(next.lastActiveAt, 2000)
})

void test('applyPropertyChanges tolerates a player that never reports Shuffle or LoopStatus', () => {
	const state = buildPlayerStateFromProperties('org.mpris.MediaPlayer2.mpv', { PlaybackStatus: 'Playing' }, 1000)
	assert.equal(state.shuffle, null)
	assert.equal(state.loopStatus, null)
})

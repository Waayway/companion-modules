import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createInitialPlayerState, type PlayerState } from '../mpris/player.js'
import type { TrackerSnapshot } from '../mpris/tracker.js'
import type { FeedbackModuleContext } from './helpers.js'
import { PlaybackFeedbacks } from './playback.js'
import { ShuffleFeedbacks } from './shuffle.js'
import { LoopFeedbacks } from './loop.js'
import { PlayerFeedbacks } from './player.js'

function fakeModule(snapshot: TrackerSnapshot): FeedbackModuleContext {
	return { getSnapshot: () => snapshot }
}

function player(overrides: Partial<PlayerState> = {}): PlayerState {
	return { ...createInitialPlayerState('org.mpris.MediaPlayer2.testplayer', 0), ...overrides }
}

function callback(definitions: Record<string, unknown>, id: string, options: Record<string, unknown> = {}): boolean {
	const definition = definitions[id] as { callback: (feedback: unknown) => boolean } | undefined
	if (!definition) throw new Error(`no such feedback definition: ${id}`)
	return definition.callback({ options })
}

void test("playing/paused/stopped reflect the selected player's status", () => {
	const playing = player({ playbackStatus: 'Playing' })
	const self = fakeModule({ players: [playing], selected: playing })
	const feedbacks = PlaybackFeedbacks(self)
	assert.equal(callback(feedbacks, 'playing'), true)
	assert.equal(callback(feedbacks, 'paused'), false)
	assert.equal(callback(feedbacks, 'stopped'), false)
})

void test('stopped is true when nothing is selected, matching the "nothing playing" default', () => {
	const self = fakeModule({ players: [], selected: null })
	const feedbacks = PlaybackFeedbacks(self)
	assert.equal(callback(feedbacks, 'playing'), false)
	assert.equal(callback(feedbacks, 'paused'), false)
	assert.equal(callback(feedbacks, 'stopped'), true)
})

void test('paused is true only while the selected player is paused', () => {
	const paused = player({ playbackStatus: 'Paused' })
	const self = fakeModule({ players: [paused], selected: paused })
	const feedbacks = PlaybackFeedbacks(self)
	assert.equal(callback(feedbacks, 'paused'), true)
	assert.equal(callback(feedbacks, 'stopped'), false)
})

void test("shuffle_on reflects the selected player's Shuffle property", () => {
	const shuffling = player({ shuffle: true })
	const feedbacks = ShuffleFeedbacks(fakeModule({ players: [shuffling], selected: shuffling }))
	assert.equal(callback(feedbacks, 'shuffle_on'), true)

	const notShuffling = player({ shuffle: false })
	const feedbacksOff = ShuffleFeedbacks(fakeModule({ players: [notShuffling], selected: notShuffling }))
	assert.equal(callback(feedbacksOff, 'shuffle_on'), false)

	const feedbacksNone = ShuffleFeedbacks(fakeModule({ players: [], selected: null }))
	assert.equal(callback(feedbacksNone, 'shuffle_on'), false)
})

void test("loop_mode_is matches the selected player's LoopStatus against the option", () => {
	const looping = player({ loopStatus: 'Track' })
	const feedbacks = LoopFeedbacks(fakeModule({ players: [looping], selected: looping }))
	assert.equal(callback(feedbacks, 'loop_mode_is', { mode: 'Track' }), true)
	assert.equal(callback(feedbacks, 'loop_mode_is', { mode: 'Playlist' }), false)
})

void test('loop_mode_is treats no selection as None', () => {
	const feedbacks = LoopFeedbacks(fakeModule({ players: [], selected: null }))
	assert.equal(callback(feedbacks, 'loop_mode_is', { mode: 'None' }), true)
	assert.equal(callback(feedbacks, 'loop_mode_is', { mode: 'Track' }), false)
})

void test('player_available is true only when a player is selected', () => {
	const active = player()
	assert.equal(callback(PlayerFeedbacks(fakeModule({ players: [active], selected: active })), 'player_available'), true)
	assert.equal(callback(PlayerFeedbacks(fakeModule({ players: [], selected: null })), 'player_available'), false)
})

void test('player_is matches the MPRIS name suffix of the selected player', () => {
	const spotify = player({ busName: 'org.mpris.MediaPlayer2.spotify' })
	const feedbacks = PlayerFeedbacks(fakeModule({ players: [spotify], selected: spotify }))
	assert.equal(callback(feedbacks, 'player_is', { player: 'spotify' }), true)
	assert.equal(callback(feedbacks, 'player_is', { player: 'mpv' }), false)
	assert.equal(callback(feedbacks, 'player_is', { player: '' }), false)
})

void test('player_is is false when nothing is selected', () => {
	const feedbacks = PlayerFeedbacks(fakeModule({ players: [], selected: null }))
	assert.equal(callback(feedbacks, 'player_is', { player: 'spotify' }), false)
})

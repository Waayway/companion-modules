import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMprisNameSuffix, matchesConfiguredPlayer, selectPlayer, type PlayerSnapshot } from './selector.js'

function player(busName: string, playbackStatus: string, lastActiveAt: number): PlayerSnapshot {
	return { busName, playbackStatus, lastActiveAt }
}

void test('getMprisNameSuffix strips the MPRIS prefix', () => {
	assert.equal(getMprisNameSuffix('org.mpris.MediaPlayer2.spotify'), 'spotify')
	assert.equal(getMprisNameSuffix('not.mpris.at.all'), 'not.mpris.at.all')
})

void test('matchesConfiguredPlayer matches the exact suffix, case-insensitively', () => {
	assert.equal(matchesConfiguredPlayer('org.mpris.MediaPlayer2.spotify', 'Spotify'), true)
	assert.equal(matchesConfiguredPlayer('org.mpris.MediaPlayer2.mpv', 'spotify'), false)
})

void test('matchesConfiguredPlayer matches an instance suffix like mpv.instance123', () => {
	assert.equal(matchesConfiguredPlayer('org.mpris.MediaPlayer2.chromium.instance1234', 'chromium'), true)
	assert.equal(matchesConfiguredPlayer('org.mpris.MediaPlayer2.chromiumx', 'chromium'), false)
})

void test('matchesConfiguredPlayer never matches an empty configured player', () => {
	assert.equal(matchesConfiguredPlayer('org.mpris.MediaPlayer2.spotify', ''), false)
	assert.equal(matchesConfiguredPlayer('org.mpris.MediaPlayer2.spotify', '   '), false)
})

void test('selectPlayer returns null when there are no players', () => {
	assert.equal(selectPlayer([], 'auto'), null)
})

void test('auto picks the playing player over a more recently active paused one', () => {
	const playing = player('org.mpris.MediaPlayer2.mpv', 'Playing', 100)
	const paused = player('org.mpris.MediaPlayer2.spotify', 'Paused', 200)
	assert.equal(selectPlayer([paused, playing], 'auto'), playing)
})

void test('auto picks the most recently active player when none are playing', () => {
	const older = player('org.mpris.MediaPlayer2.mpv', 'Paused', 100)
	const newer = player('org.mpris.MediaPlayer2.spotify', 'Paused', 200)
	assert.equal(selectPlayer([older, newer], 'auto'), newer)
})

void test('auto falls back to the first player on a tie / no activity signal', () => {
	const first = player('org.mpris.MediaPlayer2.mpv', 'Stopped', 0)
	const second = player('org.mpris.MediaPlayer2.spotify', 'Stopped', 0)
	assert.equal(selectPlayer([first, second], 'auto'), first)
})

void test('empty or unset configured player behaves like auto', () => {
	const only = player('org.mpris.MediaPlayer2.mpv', 'Stopped', 0)
	assert.equal(selectPlayer([only], ''), only)
})

void test('a specific configured player matches only itself, never falling back to auto', () => {
	const mpv = player('org.mpris.MediaPlayer2.mpv', 'Playing', 100)
	const spotify = player('org.mpris.MediaPlayer2.spotify', 'Paused', 200)
	assert.equal(selectPlayer([mpv, spotify], 'spotify'), spotify)
})

void test('a specific configured player that is not present selects nothing', () => {
	const mpv = player('org.mpris.MediaPlayer2.mpv', 'Playing', 100)
	assert.equal(selectPlayer([mpv], 'spotify'), null)
})

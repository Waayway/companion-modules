import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TransportActions } from '../actions/transport.js'
import { ShuffleActions } from '../actions/shuffle.js'
import { LoopActions } from '../actions/loop.js'
import { VolumeActions } from '../actions/volume.js'
import { PlaybackFeedbacks } from '../feedbacks/playback.js'
import { ShuffleFeedbacks } from '../feedbacks/shuffle.js'
import { LoopFeedbacks } from '../feedbacks/loop.js'
import { TransportPresets } from './transport.js'
import { ShuffleLoopPresets } from './shuffleLoop.js'
import { VolumePresets } from './volume.js'
import { NowPlayingPresets } from './nowPlaying.js'

const noopActionsSelf = { log: () => {}, getSelectedPlayerConnection: () => null, setPlayerOverride: () => {} }
const noopFeedbacksSelf = { getSnapshot: () => ({ players: [], selected: null }) }

function allActionIds(): Set<string> {
	return new Set([
		...Object.keys(TransportActions(noopActionsSelf)),
		...Object.keys(ShuffleActions(noopActionsSelf)),
		...Object.keys(LoopActions(noopActionsSelf)),
		...Object.keys(VolumeActions(noopActionsSelf)),
	])
}

function allFeedbackIds(): Set<string> {
	return new Set([
		...Object.keys(PlaybackFeedbacks(noopFeedbacksSelf)),
		...Object.keys(ShuffleFeedbacks(noopFeedbacksSelf)),
		...Object.keys(LoopFeedbacks(noopFeedbacksSelf)),
	])
}

function allPresets(): Record<string, unknown> {
	return { ...TransportPresets(), ...ShuffleLoopPresets(), ...VolumePresets() }
}

void test('every preset action references a real action definition', () => {
	const actionIds = allActionIds()
	for (const [id, preset] of Object.entries(allPresets())) {
		const { steps } = preset as { steps: { down: { actionId: string }[]; up: { actionId: string }[] }[] }
		for (const step of steps) {
			for (const action of [...step.down, ...step.up]) {
				assert.ok(actionIds.has(action.actionId), `preset "${id}" references unknown action "${action.actionId}"`)
			}
		}
	}
})

void test('every preset feedback references a real feedback definition', () => {
	const feedbackIds = allFeedbackIds()
	for (const [id, preset] of Object.entries(allPresets())) {
		const { feedbacks } = preset as { feedbacks: { feedbackId: string }[] }
		for (const feedback of feedbacks) {
			assert.ok(
				feedbackIds.has(feedback.feedbackId),
				`preset "${id}" references unknown feedback "${feedback.feedbackId}"`,
			)
		}
	}
})

void test('now playing preset interpolates the connection label into both variable references', () => {
	const presets = NowPlayingPresets({ label: 'media1' } as never)
	const preset = presets.now_playing as { style: { text: string } }
	assert.equal(preset.style.text, '$(media1:title)\n$(media1:artist)')
})

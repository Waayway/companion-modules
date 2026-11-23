import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TransportActions } from '../actions/transport.js'
import { ShuffleActions } from '../actions/shuffle.js'
import { LoopActions } from '../actions/loop.js'
import { VolumeActions } from '../actions/volume.js'
import { SeekActions } from '../actions/seek.js'
import { SelectPlayerActions } from '../actions/selectPlayer.js'
import { PlaybackFeedbacks } from '../feedbacks/playback.js'
import { ShuffleFeedbacks } from '../feedbacks/shuffle.js'
import { LoopFeedbacks } from '../feedbacks/loop.js'
import { PlayerFeedbacks } from '../feedbacks/player.js'
import { buildVariableValues } from '../variables.js'
import { TransportPresets, TRANSPORT_PRESET_IDS } from './transport.js'
import { ShuffleLoopPresets, SHUFFLE_LOOP_PRESET_IDS } from './shuffleLoop.js'
import { VolumePresets, VOLUME_PRESET_IDS } from './volume.js'
import { NowPlayingPresets, NOW_PLAYING_PRESET_IDS } from './nowPlaying.js'
import { UpdatePresets } from './index.js'

const FAKE_LABEL = 'media1'
const noopActionsSelf = { log: () => {}, getSelectedPlayerConnection: () => null, setPlayerOverride: () => {} }
const noopFeedbacksSelf = { getSnapshot: () => ({ players: [], selected: null }) }

interface StyleOverride {
	elementId: string
	elementProperty: string
	override: unknown
}
interface GraphicsElement {
	id?: string
	type: string
	color?: unknown
	[key: string]: unknown
}
interface LayeredVariant {
	type: 'layered'
	elements: GraphicsElement[]
	steps: StepActions[]
	feedbacks: { feedbackId: string; styleOverrides: StyleOverride[] }[]
}
interface SimpleVariant {
	type: 'simple'
	style: { text: string; color: number; bgcolor: number }
	steps: StepActions[]
	feedbacks: { feedbackId: string; style?: { color?: number; bgcolor?: number; text?: string } }[]
}
interface StepActions {
	down: { actionId: string }[]
	up: { actionId: string }[]
}
type Variant = LayeredVariant | SimpleVariant
type SomePreset = Variant | { type: 'alternatives'; variants: Variant[] }

function variantsOf(preset: SomePreset): Variant[] {
	return preset.type === 'alternatives' ? preset.variants : [preset]
}

function allActionIds(): Set<string> {
	return new Set([
		...Object.keys(TransportActions(noopActionsSelf)),
		...Object.keys(ShuffleActions(noopActionsSelf)),
		...Object.keys(LoopActions(noopActionsSelf)),
		...Object.keys(VolumeActions(noopActionsSelf)),
		...Object.keys(SeekActions(noopActionsSelf)),
		...Object.keys(SelectPlayerActions(noopActionsSelf)),
	])
}

function allFeedbackIds(): Set<string> {
	return new Set([
		...Object.keys(PlaybackFeedbacks(noopFeedbacksSelf)),
		...Object.keys(ShuffleFeedbacks(noopFeedbacksSelf)),
		...Object.keys(LoopFeedbacks(noopFeedbacksSelf)),
		...Object.keys(PlayerFeedbacks(noopFeedbacksSelf)),
	])
}

function allVariableIds(): Set<string> {
	return new Set(Object.keys(buildVariableValues({ players: [], selected: null })))
}

function allPresets(): Record<string, SomePreset> {
	return {
		...(TransportPresets() as unknown as Record<string, SomePreset>),
		...(ShuffleLoopPresets() as unknown as Record<string, SomePreset>),
		...(VolumePresets() as unknown as Record<string, SomePreset>),
		...(NowPlayingPresets({ label: FAKE_LABEL } as never) as unknown as Record<string, SomePreset>),
	}
}

/** Every `$(connection:variable)` reference found in a string. */
function variableRefs(text: string): { connection: string; variable: string }[] {
	return [...text.matchAll(/\$\(([^:)]+):([^)]+)\)/g)].map((m) => ({ connection: m[1], variable: m[2] }))
}

function textValuesOf(variant: Variant): string[] {
	if (variant.type === 'simple') {
		return [variant.style.text, ...variant.feedbacks.flatMap((f) => (f.style?.text !== undefined ? [f.style.text] : []))]
	}
	const values: string[] = []
	for (const element of variant.elements) {
		const text = element.text as { value?: unknown } | string | undefined
		if (typeof text === 'string') values.push(text)
		else if (text && typeof text.value === 'string') values.push(text.value)
	}
	for (const feedback of variant.feedbacks) {
		for (const override of feedback.styleOverrides) {
			if (override.elementProperty === 'text' && typeof override.override === 'string') {
				values.push(override.override)
			}
		}
	}
	return values
}

function isValidColor(value: unknown): boolean {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff
}

void test('every preset action references a real action definition', () => {
	const actionIds = allActionIds()
	for (const [id, preset] of Object.entries(allPresets())) {
		for (const variant of variantsOf(preset)) {
			for (const step of variant.steps) {
				for (const action of [...step.down, ...step.up]) {
					assert.ok(actionIds.has(action.actionId), `preset "${id}" references unknown action "${action.actionId}"`)
				}
			}
		}
	}
})

void test('every preset feedback references a real feedback definition', () => {
	const feedbackIds = allFeedbackIds()
	for (const [id, preset] of Object.entries(allPresets())) {
		for (const variant of variantsOf(preset)) {
			for (const feedback of variant.feedbacks) {
				assert.ok(
					feedbackIds.has(feedback.feedbackId),
					`preset "${id}" references unknown feedback "${feedback.feedbackId}"`,
				)
			}
		}
	}
})

void test('every layered feedback style override targets an element that exists on that preset', () => {
	for (const [id, preset] of Object.entries(allPresets())) {
		for (const variant of variantsOf(preset)) {
			if (variant.type !== 'layered') continue
			const elementIds = new Set(variant.elements.map((e) => e.id).filter((eid): eid is string => eid !== undefined))
			for (const feedback of variant.feedbacks) {
				for (const override of feedback.styleOverrides) {
					assert.ok(
						elementIds.has(override.elementId),
						`preset "${id}" feedback "${feedback.feedbackId}" overrides unknown element "${override.elementId}"`,
					)
				}
			}
		}
	}
})

void test('every preset variable reference uses a real variable id', () => {
	const variableIds = allVariableIds()
	for (const [id, preset] of Object.entries(allPresets())) {
		for (const variant of variantsOf(preset)) {
			for (const text of textValuesOf(variant)) {
				for (const ref of variableRefs(text)) {
					assert.ok(
						variableIds.has(ref.variable),
						`preset "${id}" references unknown variable "${ref.connection}:${ref.variable}" (text: ${text})`,
					)
				}
			}
		}
	}
})

void test('every preset colour is a valid 24-bit RGB value', () => {
	for (const [id, preset] of Object.entries(allPresets())) {
		for (const variant of variantsOf(preset)) {
			if (variant.type === 'simple') {
				assert.ok(isValidColor(variant.style.color), `preset "${id}" simple style has an invalid text color`)
				assert.ok(isValidColor(variant.style.bgcolor), `preset "${id}" simple style has an invalid bgcolor`)
				for (const feedback of variant.feedbacks) {
					if (feedback.style?.color !== undefined) {
						assert.ok(isValidColor(feedback.style.color), `preset "${id}" feedback has an invalid text color`)
					}
					if (feedback.style?.bgcolor !== undefined) {
						assert.ok(isValidColor(feedback.style.bgcolor), `preset "${id}" feedback has an invalid bgcolor`)
					}
				}
			} else {
				for (const element of variant.elements) {
					if (element.color !== undefined) {
						assert.ok(isValidColor(element.color), `preset "${id}" element "${String(element.id)}" has an invalid color`)
					}
				}
				for (const feedback of variant.feedbacks) {
					for (const override of feedback.styleOverrides) {
						if (override.elementProperty === 'color') {
							assert.ok(
								isValidColor(override.override),
								`preset "${id}" feedback "${feedback.feedbackId}" has an invalid color override`,
							)
						}
					}
				}
			}
		}
	}
})

void test('preset ids are unique', () => {
	const ids = [
		...Object.keys(TransportPresets()),
		...Object.keys(ShuffleLoopPresets()),
		...Object.keys(VolumePresets()),
		...Object.keys(NowPlayingPresets({ label: FAKE_LABEL } as never)),
	]
	assert.equal(ids.length, new Set(ids).size, 'duplicate preset id across preset files')
	assert.deepEqual(
		new Set(ids),
		new Set([...TRANSPORT_PRESET_IDS, ...SHUFFLE_LOOP_PRESET_IDS, ...VOLUME_PRESET_IDS, ...NOW_PLAYING_PRESET_IDS]),
	)
})

void test('the preset structure lists every preset exactly once', () => {
	const presetIds = Object.keys(allPresets())
	const captured: { structure: unknown[]; presets: unknown } = { structure: [], presets: {} }
	const fakeSelf = {
		label: FAKE_LABEL,
		setPresetDefinitions: (structure: unknown[], presets: unknown) => {
			captured.structure = structure
			captured.presets = presets
		},
	}
	UpdatePresets(fakeSelf as never)

	const listed = (captured.structure as { definitions: string[] }[]).flatMap((section) => section.definitions)
	assert.deepEqual([...listed].sort(), [...presetIds].sort(), 'structure must list every preset exactly once')
	assert.equal(listed.length, new Set(listed).size, 'a preset is listed more than once in the structure')
})

void test('now playing presets interpolate the connection label into their variable references', () => {
	const presets = NowPlayingPresets({ label: 'media1' } as never) as unknown as Record<string, SomePreset>
	const title = presets.now_playing_title as { type: 'alternatives'; variants: Variant[] }
	const simple = title.variants.find((v): v is SimpleVariant => v.type === 'simple')
	assert.equal(simple?.style.text, '$(media1:title)')
})

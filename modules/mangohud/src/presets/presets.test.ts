import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UpdateActions } from '../actions.js'
import { UpdateFeedbacks } from '../feedbacks.js'
import { UpdateVariableDefinitions } from '../variables.js'
import { PresetSwitchPresets, PRESET_SWITCH_PRESET_IDS } from './presetSwitch.js'
import { HudPresets, HUD_PRESET_IDS } from './hud.js'
import { GamescopeStatusPresets, GAMESCOPE_STATUS_PRESET_IDS } from './gamescopeStatus.js'
import { SensorsPresets, SENSORS_PRESET_IDS } from './sensors.js'
import { UpdatePresets } from './index.js'

const FAKE_LABEL = 'mangohud1'

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

function fakeSelf(): {
	label: string
	captured: { actions: Record<string, unknown>; feedbacks: Record<string, unknown>; variables: Record<string, unknown> }
} {
	const captured = { actions: {}, feedbacks: {}, variables: {} }
	const self = {
		label: FAKE_LABEL,
		captured,
		setActionDefinitions: (defs: Record<string, unknown>) => {
			captured.actions = defs
		},
		setFeedbackDefinitions: (defs: Record<string, unknown>) => {
			captured.feedbacks = defs
		},
		setVariableDefinitions: (defs: Record<string, unknown>) => {
			captured.variables = defs
		},
	}
	return self
}

function allActionIds(): Set<string> {
	const self = fakeSelf()
	UpdateActions(self as never)
	return new Set(Object.keys(self.captured.actions))
}

function allFeedbackIds(): Set<string> {
	const self = fakeSelf()
	UpdateFeedbacks(self as never)
	return new Set(Object.keys(self.captured.feedbacks))
}

function allVariableIds(): Set<string> {
	const self = fakeSelf()
	UpdateVariableDefinitions(self as never)
	return new Set(Object.keys(self.captured.variables))
}

function allPresets(): Record<string, SomePreset> {
	const self = { label: FAKE_LABEL } as never
	return {
		...(PresetSwitchPresets(self) as unknown as Record<string, SomePreset>),
		...(HudPresets() as unknown as Record<string, SomePreset>),
		...(GamescopeStatusPresets(self) as unknown as Record<string, SomePreset>),
		...(SensorsPresets(self) as unknown as Record<string, SomePreset>),
	}
}

/** Every `$(connection:variable)` reference found in a string. */
function variableRefs(text: string): { connection: string; variable: string }[] {
	return [...text.matchAll(/\$\(([^:)]+):([^)]+)\)/g)].map((m) => ({ connection: m[1], variable: m[2] }))
}

function textValuesOf(variant: Variant): string[] {
	if (variant.type === 'simple') {
		return [
			variant.style.text,
			...variant.feedbacks.flatMap((f) => (f.style?.text !== undefined ? [f.style.text] : [])),
		]
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
						assert.ok(
							isValidColor(element.color),
							`preset "${id}" element "${String(element.id)}" has an invalid color`,
						)
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
	const self = { label: FAKE_LABEL } as never
	const ids = [
		...Object.keys(PresetSwitchPresets(self)),
		...Object.keys(HudPresets()),
		...Object.keys(GamescopeStatusPresets(self)),
		...Object.keys(SensorsPresets(self)),
	]
	assert.equal(ids.length, new Set(ids).size, 'duplicate preset id across preset files')
	assert.deepEqual(
		new Set(ids),
		new Set([...PRESET_SWITCH_PRESET_IDS, ...HUD_PRESET_IDS, ...GAMESCOPE_STATUS_PRESET_IDS, ...SENSORS_PRESET_IDS]),
	)
})

void test('the preset structure lists every preset exactly once', () => {
	const presetIds = Object.keys(allPresets())
	const captured: { structure: unknown[]; presets: unknown } = { structure: [], presets: {} }
	const self = {
		label: FAKE_LABEL,
		setPresetDefinitions: (structure: unknown[], presets: unknown) => {
			captured.structure = structure
			captured.presets = presets
		},
	}
	UpdatePresets(self as never)

	const listed = (captured.structure as { definitions: string[] }[]).flatMap((section) => section.definitions)
	assert.deepEqual([...listed].sort(), [...presetIds].sort(), 'structure must list every preset exactly once')
	assert.equal(listed.length, new Set(listed).size, 'a preset is listed more than once in the structure')
})

void test('the preset cycle button interpolates the connection label', () => {
	const presets = PresetSwitchPresets({ label: 'mangohud1' } as never) as unknown as Record<string, SomePreset>
	const cycle = presets.preset_cycle as { type: 'alternatives'; variants: Variant[] }
	const simple = cycle.variants.find((v): v is SimpleVariant => v.type === 'simple')
	assert.equal(simple?.style.text, '$(mangohud1:preset_name)')
})

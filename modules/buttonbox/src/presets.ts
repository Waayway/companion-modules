import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type ModuleInstance from './main.js'
import type { ModuleSchema } from './main.js'

const LABEL = 0xffffff
const BG = 0x000000
const BUTTONS = Array.from({ length: 32 }, (_, i) => i + 1)

export function UpdatePresets(self: ModuleInstance): void {
	const hold: CompanionPresetDefinitions<ModuleSchema> = {}
	const tap: CompanionPresetDefinitions<ModuleSchema> = {}
	for (const n of BUTTONS) {
		hold[`hold_${n}`] = {
			type: 'simple',
			name: `Hold button ${n}`,
			style: { text: `Hold ${n}`, size: 'auto', color: LABEL, bgcolor: BG },
			steps: [
				{
					down: [{ actionId: 'press', options: { button: n } }],
					up: [{ actionId: 'release', options: { button: n } }],
				},
			],
			feedbacks: [],
		}
		tap[`tap_${n}`] = {
			type: 'simple',
			name: `Tap button ${n}`,
			style: { text: `Tap ${n}`, size: 'auto', color: LABEL, bgcolor: BG },
			steps: [{ down: [{ actionId: 'tap', options: { button: n } }], up: [] }],
			feedbacks: [],
		}
	}
	const structure: CompanionPresetSection[] = [
		{ id: 'hold', name: 'Hold', definitions: Object.keys(hold) },
		{ id: 'tap', name: 'Tap', definitions: Object.keys(tap) },
	]
	self.setPresetDefinitions(structure, { ...hold, ...tap })
}

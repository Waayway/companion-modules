import type ModuleInstance from '../main.js'
import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'
import { ACTIVE_LABEL, SELECTED_BLUE } from './colors.js'

export const PRESET_SWITCH_PRESET_IDS = ['preset_bar', 'preset_detail', 'preset_off', 'preset_cycle']

/** Preset numbers/labels match the module's config defaults: cycle "1,2,0", labels "0=Off,1=Bar,2=Detail". */
export function PresetSwitchPresets(self: ModuleInstance): CompanionPresetDefinitions<ModuleSchema> {
	return {
		preset_bar: buttonPreset({
			name: 'MangoHud preset: Bar',
			text: 'BAR',
			steps: [{ down: [{ actionId: 'set_preset', options: { preset: 1 } }], up: [] }],
			states: [{ feedbackId: 'preset_is', options: { preset: 1 }, boxColor: SELECTED_BLUE, textColor: ACTIVE_LABEL }],
		}),
		preset_detail: buttonPreset({
			name: 'MangoHud preset: Detail',
			text: 'DETAIL',
			steps: [{ down: [{ actionId: 'set_preset', options: { preset: 2 } }], up: [] }],
			states: [{ feedbackId: 'preset_is', options: { preset: 2 }, boxColor: SELECTED_BLUE, textColor: ACTIVE_LABEL }],
		}),
		preset_off: buttonPreset({
			name: 'MangoHud preset: Off',
			text: 'OFF',
			steps: [{ down: [{ actionId: 'set_preset', options: { preset: 0 } }], up: [] }],
			states: [{ feedbackId: 'preset_is', options: { preset: 0 }, boxColor: SELECTED_BLUE, textColor: ACTIVE_LABEL }],
		}),
		preset_cycle: buttonPreset({
			name: 'MangoHud preset: Cycle',
			text: `$(${self.label}:preset_name)`,
			expression: `$(${self.label}:preset_name)`,
			fontsize: 62,
			steps: [{ down: [{ actionId: 'cycle_preset', options: {} }], up: [] }],
		}),
	}
}

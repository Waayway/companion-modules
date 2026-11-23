import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { IDLE_BG, IDLE_LABEL } from './colors.js'

export const HUD_PRESET_IDS = ['hud_toggle', 'logging_toggle']

/**
 * Small extras, not part of the owner's original pages: MangoHud has no state readback for the HUD
 * or logging toggle (see HELP.md), so these have no feedback and stay plain simple presets.
 */
export function HudPresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		hud_toggle: {
			type: 'simple',
			name: 'Toggle HUD',
			style: { text: 'HUD', size: 'auto', color: IDLE_LABEL, bgcolor: IDLE_BG },
			steps: [{ down: [{ actionId: 'toggle_hud', options: {} }], up: [] }],
			feedbacks: [],
		},
		logging_toggle: {
			type: 'simple',
			name: 'Toggle logging',
			style: { text: 'LOG', size: 'auto', color: IDLE_LABEL, bgcolor: IDLE_BG },
			steps: [{ down: [{ actionId: 'toggle_logging', options: {} }], up: [] }],
			feedbacks: [],
		},
	}
}

import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'
import { ACTIVE_LABEL, SELECTED_BLUE } from './colors.js'

export const SHUFFLE_LOOP_PRESET_IDS = ['shuffle', 'loop']

export function ShuffleLoopPresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		shuffle: buttonPreset({
			name: 'Shuffle',
			text: 'SHUFFLE',
			fontsize: 62,
			steps: [{ down: [{ actionId: 'shuffle', options: { mode: 'toggle' } }], up: [] }],
			states: [{ feedbackId: 'shuffle_on', options: {}, boxColor: SELECTED_BLUE, textColor: ACTIVE_LABEL }],
		}),
		loop: buttonPreset({
			name: 'Loop',
			text: 'REPEAT',
			steps: [{ down: [{ actionId: 'loop', options: { mode: 'cycle' } }], up: [] }],
			states: [
				{
					feedbackId: 'loop_mode_is',
					options: { mode: 'Playlist' },
					boxColor: SELECTED_BLUE,
					textColor: ACTIVE_LABEL,
					text: 'ALL',
				},
				{
					feedbackId: 'loop_mode_is',
					options: { mode: 'Track' },
					boxColor: SELECTED_BLUE,
					textColor: ACTIVE_LABEL,
					text: 'ONE',
				},
			],
		}),
	}
}

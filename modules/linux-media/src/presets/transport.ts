import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'
import { ACTIVE_LABEL, SELECTED_BLUE } from './colors.js'

export const TRANSPORT_PRESET_IDS = ['previous', 'play_pause', 'next']

export function TransportPresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		previous: buttonPreset({
			name: 'Previous track',
			text: 'PREV',
			steps: [{ down: [{ actionId: 'previous', options: {} }], up: [] }],
		}),
		play_pause: buttonPreset({
			name: 'Play / Pause',
			text: 'PLAY',
			steps: [{ down: [{ actionId: 'playpause', options: {} }], up: [] }],
			states: [
				{
					feedbackId: 'playing',
					options: {},
					boxColor: SELECTED_BLUE,
					textColor: ACTIVE_LABEL,
					text: 'PAUSE',
				},
			],
		}),
		next: buttonPreset({
			name: 'Next track',
			text: 'NEXT',
			steps: [{ down: [{ actionId: 'next', options: {} }], up: [] }],
		}),
	}
}

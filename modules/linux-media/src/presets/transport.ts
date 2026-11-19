import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'

export const TRANSPORT_PRESET_IDS = ['play_pause', 'next', 'previous', 'stop']

export function TransportPresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		play_pause: {
			type: 'simple',
			name: 'Play/Pause',
			style: { text: '⏯', size: 44, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'playpause', options: {} }], up: [] }],
			feedbacks: [{ feedbackId: 'playing', options: {}, style: { bgcolor: 0x00ff00, color: 0x000000 } }],
		},
		next: {
			type: 'simple',
			name: 'Next',
			style: { text: '⏭', size: 44, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'next', options: {} }], up: [] }],
			feedbacks: [],
		},
		previous: {
			type: 'simple',
			name: 'Previous',
			style: { text: '⏮', size: 44, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'previous', options: {} }], up: [] }],
			feedbacks: [],
		},
		stop: {
			type: 'simple',
			name: 'Stop',
			style: { text: '⏹', size: 44, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'stop', options: {} }], up: [] }],
			feedbacks: [],
		},
	}
}

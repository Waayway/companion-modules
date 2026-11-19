import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'

export const SHUFFLE_LOOP_PRESET_IDS = ['shuffle', 'loop']

export function ShuffleLoopPresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		shuffle: {
			type: 'simple',
			name: 'Shuffle',
			style: { text: '🔀', size: 44, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'shuffle', options: { mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'shuffle_on', options: {}, style: { bgcolor: 0x00ff00, color: 0x000000 } }],
		},
		loop: {
			type: 'simple',
			name: 'Loop',
			style: { text: '🔁', size: 44, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'loop', options: { mode: 'cycle' } }], up: [] }],
			feedbacks: [
				{ feedbackId: 'loop_mode_is', options: { mode: 'Playlist' }, style: { bgcolor: 0x00ff00, color: 0x000000 } },
				{ feedbackId: 'loop_mode_is', options: { mode: 'Track' }, style: { bgcolor: 0x00ff00, color: 0x000000 } },
			],
		},
	}
}

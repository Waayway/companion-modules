import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'

export const VOLUME_PRESET_IDS = ['volume_up', 'volume_down']

export function VolumePresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		volume_up: {
			type: 'simple',
			name: 'Volume up',
			style: { text: '🔈+', size: 24, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'volume_up', options: { step: 5 } }], up: [] }],
			feedbacks: [],
		},
		volume_down: {
			type: 'simple',
			name: 'Volume down',
			style: { text: '🔈-', size: 24, color: 0xffffff, bgcolor: 0x000000 },
			steps: [{ down: [{ actionId: 'volume_down', options: { step: 5 } }], up: [] }],
			feedbacks: [],
		},
	}
}

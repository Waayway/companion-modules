import type ModuleInstance from '../main.js'
import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'

export const NOW_PLAYING_PRESET_IDS = ['now_playing']

export function NowPlayingPresets(self: ModuleInstance): CompanionPresetDefinitions<ModuleSchema> {
	return {
		now_playing: {
			type: 'simple',
			name: 'Now playing',
			style: {
				text: `$(${self.label}:title)\n$(${self.label}:artist)`,
				size: '14',
				color: 0xffffff,
				bgcolor: 0x000000,
			},
			steps: [],
			feedbacks: [],
		},
	}
}

import type ModuleInstance from '../main.js'
import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'
import { PLAYING_TEXT } from './colors.js'

export const NOW_PLAYING_PRESET_IDS = ['now_playing_title', 'now_playing_artist', 'app_volume']

export function NowPlayingPresets(self: ModuleInstance): CompanionPresetDefinitions<ModuleSchema> {
	return {
		now_playing_title: buttonPreset({
			name: 'Now playing: title',
			text: `$(${self.label}:title)`,
			expression: `$(${self.label}:title)`,
			fontsize: 44,
			steps: [{ down: [{ actionId: 'playpause', options: {} }], up: [] }],
			states: [{ feedbackId: 'playing', options: {}, textColor: PLAYING_TEXT }],
		}),
		now_playing_artist: buttonPreset({
			name: 'Now playing: artist',
			text: `$(${self.label}:artist)`,
			expression: `$(${self.label}:artist)`,
			fontsize: 44,
			steps: [{ down: [], up: [] }],
			states: [{ feedbackId: 'playing', options: {}, textColor: PLAYING_TEXT }],
		}),
		app_volume: buttonPreset({
			name: 'App volume',
			text: `APP $(${self.label}:volume)%`,
			expression: `concat('APP ', $(${self.label}:volume), '%')`,
			fontsize: 44,
			steps: [{ down: [], up: [] }],
		}),
	}
}

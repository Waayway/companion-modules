import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'

export const VOLUME_PRESET_IDS = ['volume_up', 'volume_down']

export function VolumePresets(): CompanionPresetDefinitions<ModuleSchema> {
	return {
		volume_up: buttonPreset({
			name: 'Volume up',
			text: 'VOL +',
			steps: [{ down: [{ actionId: 'volume_up', options: { step: 5 } }], up: [] }],
		}),
		volume_down: buttonPreset({
			name: 'Volume down',
			text: 'VOL -',
			steps: [{ down: [{ actionId: 'volume_down', options: { step: 5 } }], up: [] }],
		}),
	}
}

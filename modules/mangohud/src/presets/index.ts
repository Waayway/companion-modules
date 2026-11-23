import type ModuleInstance from '../main.js'
import type { CompanionPresetSection } from '@companion-module/base'
import { PresetSwitchPresets, PRESET_SWITCH_PRESET_IDS } from './presetSwitch.js'
import { HudPresets, HUD_PRESET_IDS } from './hud.js'
import { GamescopeStatusPresets, GAMESCOPE_STATUS_PRESET_IDS } from './gamescopeStatus.js'
import { SensorsPresets, SENSORS_PRESET_IDS } from './sensors.js'

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection[] = [
		{
			id: 'gaming_hud',
			name: 'Gaming: HUD',
			definitions: [...PRESET_SWITCH_PRESET_IDS, ...HUD_PRESET_IDS],
		},
		{
			id: 'gaming_status',
			name: 'Gaming: status',
			definitions: GAMESCOPE_STATUS_PRESET_IDS,
		},
		{
			id: 'gaming_sensors',
			name: 'Gaming: sensors',
			definitions: SENSORS_PRESET_IDS,
		},
	]

	self.setPresetDefinitions(structure, {
		...PresetSwitchPresets(self),
		...HudPresets(),
		...GamescopeStatusPresets(self),
		...SensorsPresets(self),
	})
}

import type ModuleInstance from '../main.js'
import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'
import { ACTIVE_LABEL, FAIL_RED, ON_GREEN } from './colors.js'

export const GAMESCOPE_STATUS_PRESET_IDS = ['hdr', 'vrr', 'wsi', 'game_mode', 'scope', 'gamescope_mode']

export function GamescopeStatusPresets(self: ModuleInstance): CompanionPresetDefinitions<ModuleSchema> {
	return {
		hdr: buttonPreset({
			name: 'Gamescope: HDR',
			text: 'HDR',
			fontsize: 62,
			steps: [{ down: [], up: [] }],
			states: [
				{ feedbackId: 'gamescope_hdr_on', options: {}, boxColor: ON_GREEN, textColor: ACTIVE_LABEL },
				{
					feedbackId: 'gamescope_hdr_req',
					options: {},
					boxColor: FAIL_RED,
					textColor: ACTIVE_LABEL,
					text: 'HDR\nFAIL',
				},
			],
		}),
		vrr: buttonPreset({
			name: 'Gamescope: VRR',
			text: 'VRR',
			fontsize: 62,
			steps: [{ down: [], up: [] }],
			states: [
				{ feedbackId: 'gamescope_vrr_on', options: {}, boxColor: ON_GREEN, textColor: ACTIVE_LABEL },
				{
					feedbackId: 'gamescope_vrr_req',
					options: {},
					boxColor: FAIL_RED,
					textColor: ACTIVE_LABEL,
					text: 'VRR\nFAIL',
				},
			],
		}),
		// No "WSI on" feedback exists on the module (see feedbacks.ts): idle covers the "on" state.
		wsi: buttonPreset({
			name: 'Gamescope: WSI',
			text: 'WSI',
			fontsize: 62,
			steps: [{ down: [], up: [] }],
			states: [
				{ feedbackId: 'gamescope_wsi_off', options: {}, boxColor: FAIL_RED, textColor: ACTIVE_LABEL, text: 'WSI\nOFF' },
			],
		}),
		// No "requested but inactive" feedback exists for GameMode, unlike HDR/VRR: on/off only.
		game_mode: buttonPreset({
			name: 'Gamescope: Game mode',
			text: 'GAME\nMODE',
			fontsize: 62,
			steps: [{ down: [], up: [] }],
			states: [{ feedbackId: 'gamemode_active', options: {}, boxColor: ON_GREEN, textColor: ACTIVE_LABEL }],
		}),
		scope: buttonPreset({
			name: 'Gamescope: running',
			text: 'SCOPE',
			fontsize: 80,
			steps: [{ down: [], up: [] }],
			states: [{ feedbackId: 'gamescope_running', options: {}, boxColor: ON_GREEN, textColor: ACTIVE_LABEL }],
		}),
		gamescope_mode: buttonPreset({
			name: 'Gamescope: output mode',
			text: `$(${self.label}:gs_mode)`,
			expression: `$(${self.label}:gs_mode)`,
			fontsize: 44,
			steps: [{ down: [], up: [] }],
		}),
	}
}

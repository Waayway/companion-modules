import type ModuleInstance from '../main.js'
import type { ModuleSchema } from '../main.js'
import type { CompanionPresetDefinitions } from '@companion-module/base'
import { buttonPreset } from './button.js'
import { ACTIVE_LABEL, FAIL_RED, WARNING_ORANGE } from './colors.js'

export const SENSORS_PRESET_IDS = ['cpu_temp', 'gpu_temp']

export function SensorsPresets(self: ModuleInstance): CompanionPresetDefinitions<ModuleSchema> {
	return {
		cpu_temp: buttonPreset({
			name: 'CPU temperature',
			text: `$(${self.label}:cpu_temp)°C`,
			expression: `concat($(${self.label}:cpu_temp), '°C')`,
			fontsize: 62,
			steps: [{ down: [], up: [] }],
			states: [
				{ feedbackId: 'cpu_temp_above', options: { threshold: 80 }, boxColor: WARNING_ORANGE, textColor: ACTIVE_LABEL },
				{ feedbackId: 'cpu_temp_above', options: { threshold: 90 }, boxColor: FAIL_RED, textColor: ACTIVE_LABEL },
			],
		}),
		gpu_temp: buttonPreset({
			name: 'GPU temperature + load',
			text: `$(${self.label}:gpu_temp)°C\n$(${self.label}:gpu_load)%`,
			expression: `concat($(${self.label}:gpu_temp), '°C\n', $(${self.label}:gpu_load), '%')`,
			fontsize: 62,
			steps: [{ down: [], up: [] }],
			states: [
				{ feedbackId: 'gpu_temp_above', options: { threshold: 80 }, boxColor: WARNING_ORANGE, textColor: ACTIVE_LABEL },
				{ feedbackId: 'gpu_temp_above', options: { threshold: 95 }, boxColor: FAIL_RED, textColor: ACTIVE_LABEL },
			],
		}),
	}
}

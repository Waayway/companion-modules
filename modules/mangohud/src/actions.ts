import type ModuleInstance from './main.js'

export type ActionsSchema = {
	set_preset: { options: { preset: number } }
	cycle_preset: { options: Record<string, never> }
	toggle_hud: { options: Record<string, never> }
	start_logging: { options: Record<string, never> }
	stop_logging: { options: Record<string, never> }
	toggle_logging: { options: Record<string, never> }
	toggle_fcat: { options: Record<string, never> }
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		set_preset: {
			name: 'Set preset',
			options: [
				{
					id: 'preset',
					type: 'number',
					label: 'Preset number (-1 for off/custom)',
					default: 0,
					min: -1,
					max: 99,
				},
			],
			callback: async (action) => {
				self.presets.setPreset(action.options.preset)
			},
		},
		cycle_preset: {
			name: 'Cycle preset',
			options: [],
			callback: async () => {
				self.presets.cyclePreset()
			},
		},
		toggle_hud: {
			name: 'Toggle HUD',
			options: [],
			callback: async () => {
				await self.control.toggleHud()
			},
		},
		start_logging: {
			name: 'Start logging',
			options: [],
			callback: async () => {
				await self.control.setLogging(1)
			},
		},
		stop_logging: {
			name: 'Stop logging',
			options: [],
			callback: async () => {
				await self.control.setLogging(0)
			},
		},
		toggle_logging: {
			name: 'Toggle logging',
			options: [],
			callback: async () => {
				await self.control.setLogging()
			},
		},
		toggle_fcat: {
			name: 'Toggle fcat overlay',
			options: [],
			callback: async () => {
				await self.control.toggleFcat()
			},
		},
	})
}

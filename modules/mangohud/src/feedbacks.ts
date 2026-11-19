import type ModuleInstance from './main.js'

export type FeedbacksSchema = {
	preset_is: {
		type: 'boolean'
		options: { preset: number }
	}
	control_socket_reachable: {
		type: 'boolean'
		options: Record<string, never>
	}
	gamemode_active: {
		type: 'boolean'
		options: Record<string, never>
	}
	cpu_temp_above: {
		type: 'boolean'
		options: { threshold: number }
	}
	gpu_temp_above: {
		type: 'boolean'
		options: { threshold: number }
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		preset_is: {
			name: 'Preset is',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0x00c800,
				color: 0x000000,
			},
			options: [
				{
					id: 'preset',
					type: 'number',
					label: 'Preset number',
					default: 0,
					min: -1,
					max: 99,
				},
			],
			callback: (feedback) => {
				return self.presets.getCurrentPreset() === feedback.options.preset
			},
		},
		control_socket_reachable: {
			name: 'Control socket reachable',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0x00c800,
				color: 0x000000,
			},
			options: [],
			callback: async () => {
				return self.control.isReachable()
			},
		},
		gamemode_active: {
			name: 'GameMode active',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0x00c800,
				color: 0x000000,
			},
			options: [],
			callback: () => {
				return self.gamemode.isActive()
			},
		},
		cpu_temp_above: {
			name: 'CPU temperature above',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0xc80000,
				color: 0xffffff,
			},
			options: [
				{
					id: 'threshold',
					type: 'number',
					label: 'Threshold (°C)',
					default: 80,
					min: 0,
					max: 150,
				},
			],
			callback: (feedback) => {
				const temp = self.sensors.getCpuTemp()
				return temp !== null && temp > feedback.options.threshold
			},
		},
		gpu_temp_above: {
			name: 'GPU temperature above',
			type: 'boolean',
			defaultStyle: {
				bgcolor: 0xc80000,
				color: 0xffffff,
			},
			options: [
				{
					id: 'threshold',
					type: 'number',
					label: 'Threshold (°C)',
					default: 80,
					min: 0,
					max: 150,
				},
			],
			callback: (feedback) => {
				const temp = self.sensors.getGpuTemp()
				return temp !== null && temp > feedback.options.threshold
			},
		},
	})
}

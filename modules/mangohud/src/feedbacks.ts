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
	})
}

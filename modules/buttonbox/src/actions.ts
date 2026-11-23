import type ModuleInstance from './main.js'

export const TAP_MS = 80

type ButtonOptions = { options: { button: number } }

export type ActionsSchema = {
	press: ButtonOptions
	release: ButtonOptions
	tap: ButtonOptions
}

const buttonOption = [
	{
		id: 'button' as const,
		type: 'number' as const,
		label: 'Button (1-32)',
		default: 1,
		min: 1,
		max: 32,
	},
]

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		press: {
			name: 'Press (hold)',
			options: buttonOption,
			callback: async (action) => {
				self.client?.send('down', action.options.button)
			},
		},
		release: {
			name: 'Release',
			options: buttonOption,
			callback: async (action) => {
				self.client?.send('up', action.options.button)
			},
		},
		tap: {
			name: 'Tap (press, 80 ms, release)',
			options: buttonOption,
			callback: async (action) => {
				const n = action.options.button
				self.client?.send('down', n)
				await new Promise((resolve) => setTimeout(resolve, TAP_MS))
				self.client?.send('up', n)
			},
		},
	})
}

import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ActionModuleContext } from './helpers.js'

export type SelectPlayerActionsSchema = {
	select_player: { options: { player: string } }
}

export function SelectPlayerActions(self: ActionModuleContext): CompanionActionDefinitions<SelectPlayerActionsSchema> {
	return {
		select_player: {
			name: 'Select player',
			options: [
				{
					id: 'player',
					type: 'textinput',
					label: 'Player ("auto", or an MPRIS name such as spotify)',
					default: 'auto',
				},
			],
			callback: (event) => {
				const trimmed = event.options.player.trim()
				self.setPlayerOverride(trimmed === '' || trimmed.toLowerCase() === 'auto' ? null : trimmed)
			},
		},
	}
}

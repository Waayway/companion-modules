import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import { matchesConfiguredPlayer } from '../mpris/selector.js'
import type { FeedbackModuleContext } from './helpers.js'

export type PlayerFeedbacksSchema = {
	player_available: { type: 'boolean'; options: Record<string, never> }
	player_is: { type: 'boolean'; options: { player: string } }
}

export function PlayerFeedbacks(self: FeedbackModuleContext): CompanionFeedbackDefinitions<PlayerFeedbacksSchema> {
	return {
		player_available: {
			type: 'boolean',
			name: 'Player available',
			defaultStyle: { bgcolor: 0x00cc00, color: 0xffffff },
			options: [],
			callback: () => self.getSnapshot().selected !== null,
		},
		player_is: {
			type: 'boolean',
			name: 'Player is',
			defaultStyle: { bgcolor: 0xff00ff, color: 0xffffff },
			options: [
				{
					id: 'player',
					type: 'textinput',
					label: 'Player (MPRIS name suffix, e.g. spotify)',
					default: '',
				},
			],
			callback: (feedback) => {
				const selected = self.getSnapshot().selected
				return selected !== null && matchesConfiguredPlayer(selected.busName, feedback.options.player)
			},
		},
	}
}

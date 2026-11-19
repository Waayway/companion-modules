import type { CompanionActionDefinitions } from '@companion-module/base'
import { secondsToMicroseconds } from '../mpris/seek.js'
import { withSelectedPlayer, type ActionModuleContext } from './helpers.js'

export type SeekActionsSchema = {
	seek: { options: { seconds: number } }
}

export function SeekActions(self: ActionModuleContext): CompanionActionDefinitions<SeekActionsSchema> {
	return {
		seek: {
			name: 'Seek relative',
			options: [
				{
					id: 'seconds',
					type: 'number',
					label: 'Seconds (negative to seek backward)',
					default: 10,
					min: -3600,
					max: 3600,
				},
			],
			callback: async (event) => {
				await withSelectedPlayer(self, 'seek', async (connection) => {
					await connection.player.Seek(secondsToMicroseconds(event.options.seconds))
				})
			},
		},
	}
}

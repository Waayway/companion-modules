import type { CompanionActionDefinitions } from '@companion-module/base'
import { withSelectedPlayer, type ActionModuleContext } from './helpers.js'

export type TransportActionsSchema = {
	play: { options: Record<string, never> }
	pause: { options: Record<string, never> }
	playpause: { options: Record<string, never> }
	stop: { options: Record<string, never> }
	next: { options: Record<string, never> }
	previous: { options: Record<string, never> }
}

export function TransportActions(self: ActionModuleContext): CompanionActionDefinitions<TransportActionsSchema> {
	return {
		play: {
			name: 'Play',
			options: [],
			callback: async () => {
				await withSelectedPlayer(self, 'play', async (connection) => {
					await connection.player.Play()
				})
			},
		},
		pause: {
			name: 'Pause',
			options: [],
			callback: async () => {
				await withSelectedPlayer(self, 'pause', async (connection) => {
					await connection.player.Pause()
				})
			},
		},
		playpause: {
			name: 'Play/Pause',
			options: [],
			callback: async () => {
				await withSelectedPlayer(self, 'play/pause', async (connection) => {
					await connection.player.PlayPause()
				})
			},
		},
		stop: {
			name: 'Stop',
			options: [],
			callback: async () => {
				await withSelectedPlayer(self, 'stop', async (connection) => {
					await connection.player.Stop()
				})
			},
		},
		next: {
			name: 'Next',
			options: [],
			callback: async () => {
				await withSelectedPlayer(self, 'next', async (connection) => {
					await connection.player.Next()
				})
			},
		},
		previous: {
			name: 'Previous',
			options: [],
			callback: async () => {
				await withSelectedPlayer(self, 'previous', async (connection) => {
					await connection.player.Previous()
				})
			},
		},
	}
}

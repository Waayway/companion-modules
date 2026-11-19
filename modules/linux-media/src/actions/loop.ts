import dbus from '@particle/dbus-next'
import type { CompanionActionDefinitions } from '@companion-module/base'
import { MPRIS_PLAYER_INTERFACE } from '../mpris/player.js'
import { nextLoopStatus } from '../mpris/loop.js'
import { unwrapVariant } from '../mpris/variant.js'
import { withSelectedPlayer, type ActionModuleContext } from './helpers.js'

export type LoopActionsSchema = {
	loop: { options: { mode: 'cycle' | 'None' | 'Playlist' | 'Track' } }
}

export function LoopActions(self: ActionModuleContext): CompanionActionDefinitions<LoopActionsSchema> {
	return {
		loop: {
			name: 'Loop',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					default: 'cycle',
					choices: [
						{ id: 'cycle', label: 'Cycle (None -> Playlist -> Track)' },
						{ id: 'None', label: 'None' },
						{ id: 'Playlist', label: 'Playlist' },
						{ id: 'Track', label: 'Track' },
					],
				},
			],
			callback: async (event) => {
				await withSelectedPlayer(self, 'loop', async (connection) => {
					let next: string
					if (event.options.mode === 'cycle') {
						const current = unwrapVariant(await connection.properties.Get(MPRIS_PLAYER_INTERFACE, 'LoopStatus'))
						next = nextLoopStatus(typeof current === 'string' ? current : null)
					} else {
						next = event.options.mode
					}
					await connection.properties.Set(MPRIS_PLAYER_INTERFACE, 'LoopStatus', new dbus.Variant('s', next))
				})
			},
		},
	}
}

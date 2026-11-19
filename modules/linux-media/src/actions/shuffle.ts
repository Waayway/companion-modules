import dbus from '@particle/dbus-next'
import type { CompanionActionDefinitions } from '@companion-module/base'
import { MPRIS_PLAYER_INTERFACE } from '../mpris/player.js'
import { resolveShuffleValue, type ShuffleMode } from '../mpris/shuffle.js'
import { unwrapVariant } from '../mpris/variant.js'
import { withSelectedPlayer, type ActionModuleContext } from './helpers.js'

export type ShuffleActionsSchema = {
	shuffle: { options: { mode: ShuffleMode } }
}

export function ShuffleActions(self: ActionModuleContext): CompanionActionDefinitions<ShuffleActionsSchema> {
	return {
		shuffle: {
			name: 'Shuffle',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
					],
				},
			],
			callback: async (event) => {
				await withSelectedPlayer(self, 'shuffle', async (connection) => {
					const current = unwrapVariant(await connection.properties.Get(MPRIS_PLAYER_INTERFACE, 'Shuffle'))
					const next = resolveShuffleValue(typeof current === 'boolean' ? current : null, event.options.mode)
					await connection.properties.Set(MPRIS_PLAYER_INTERFACE, 'Shuffle', new dbus.Variant('b', next))
				})
			},
		},
	}
}

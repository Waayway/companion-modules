import dbus from '@particle/dbus-next'
import type { CompanionActionDefinitions } from '@companion-module/base'
import { MPRIS_PLAYER_INTERFACE, type PlayerConnection } from '../mpris/player.js'
import { percentToVolume, stepVolumePercent, volumeToPercent } from '../mpris/volume.js'
import { unwrapVariant } from '../mpris/variant.js'
import { withSelectedPlayer, type ActionModuleContext } from './helpers.js'

export type VolumeActionsSchema = {
	volume_up: { options: { step: number } }
	volume_down: { options: { step: number } }
	volume_set: { options: { value: number } }
}

async function currentVolumePercent(connection: PlayerConnection): Promise<number> {
	const current = unwrapVariant(await connection.properties.Get(MPRIS_PLAYER_INTERFACE, 'Volume'))
	return typeof current === 'number' ? volumeToPercent(current) : 0
}

export function VolumeActions(self: ActionModuleContext): CompanionActionDefinitions<VolumeActionsSchema> {
	const stepOption = {
		id: 'step' as const,
		type: 'number' as const,
		label: 'Step (%)',
		default: 5,
		min: 1,
		max: 100,
	}

	return {
		volume_up: {
			name: 'Volume up',
			options: [stepOption],
			callback: async (event) => {
				await withSelectedPlayer(self, 'volume up', async (connection) => {
					const next = stepVolumePercent(await currentVolumePercent(connection), event.options.step, 1)
					await connection.properties.Set(
						MPRIS_PLAYER_INTERFACE,
						'Volume',
						new dbus.Variant('d', percentToVolume(next)),
					)
				})
			},
		},
		volume_down: {
			name: 'Volume down',
			options: [stepOption],
			callback: async (event) => {
				await withSelectedPlayer(self, 'volume down', async (connection) => {
					const next = stepVolumePercent(await currentVolumePercent(connection), event.options.step, -1)
					await connection.properties.Set(
						MPRIS_PLAYER_INTERFACE,
						'Volume',
						new dbus.Variant('d', percentToVolume(next)),
					)
				})
			},
		},
		volume_set: {
			name: 'Volume set',
			options: [
				{
					id: 'value',
					type: 'number',
					label: 'Volume (%)',
					default: 100,
					min: 0,
					max: 100,
				},
			],
			callback: async (event) => {
				await withSelectedPlayer(self, 'volume set', async (connection) => {
					await connection.properties.Set(
						MPRIS_PLAYER_INTERFACE,
						'Volume',
						new dbus.Variant('d', percentToVolume(event.options.value)),
					)
				})
			},
		},
	}
}

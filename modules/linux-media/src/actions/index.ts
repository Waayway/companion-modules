import type ModuleInstance from '../main.js'
import { TransportActions, type TransportActionsSchema } from './transport.js'
import { ShuffleActions, type ShuffleActionsSchema } from './shuffle.js'
import { LoopActions, type LoopActionsSchema } from './loop.js'
import { VolumeActions, type VolumeActionsSchema } from './volume.js'
import { SeekActions, type SeekActionsSchema } from './seek.js'
import { SelectPlayerActions, type SelectPlayerActionsSchema } from './selectPlayer.js'

export type ActionsSchema = TransportActionsSchema &
	ShuffleActionsSchema &
	LoopActionsSchema &
	VolumeActionsSchema &
	SeekActionsSchema &
	SelectPlayerActionsSchema

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		...TransportActions(self),
		...ShuffleActions(self),
		...LoopActions(self),
		...VolumeActions(self),
		...SeekActions(self),
		...SelectPlayerActions(self),
	})
}

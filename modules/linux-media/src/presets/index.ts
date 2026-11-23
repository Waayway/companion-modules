import type ModuleInstance from '../main.js'
import type { CompanionPresetSection } from '@companion-module/base'
import { TransportPresets, TRANSPORT_PRESET_IDS } from './transport.js'
import { ShuffleLoopPresets, SHUFFLE_LOOP_PRESET_IDS } from './shuffleLoop.js'
import { VolumePresets, VOLUME_PRESET_IDS } from './volume.js'
import { NowPlayingPresets, NOW_PLAYING_PRESET_IDS } from './nowPlaying.js'

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection[] = [
		{
			id: 'music',
			name: 'Music',
			definitions: [...NOW_PLAYING_PRESET_IDS, ...TRANSPORT_PRESET_IDS],
		},
		{
			id: 'controls',
			name: 'Controls',
			definitions: [...SHUFFLE_LOOP_PRESET_IDS, ...VOLUME_PRESET_IDS],
		},
	]

	self.setPresetDefinitions(structure, {
		...TransportPresets(),
		...ShuffleLoopPresets(),
		...VolumePresets(),
		...NowPlayingPresets(self),
	})
}

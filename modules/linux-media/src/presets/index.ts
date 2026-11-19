import type ModuleInstance from '../main.js'
import type { CompanionPresetSection } from '@companion-module/base'
import { TransportPresets, TRANSPORT_PRESET_IDS } from './transport.js'
import { ShuffleLoopPresets, SHUFFLE_LOOP_PRESET_IDS } from './shuffleLoop.js'
import { VolumePresets, VOLUME_PRESET_IDS } from './volume.js'
import { NowPlayingPresets, NOW_PLAYING_PRESET_IDS } from './nowPlaying.js'

export function UpdatePresets(self: ModuleInstance): void {
	const structure: CompanionPresetSection[] = [
		{
			id: 'transport',
			name: 'Transport',
			definitions: TRANSPORT_PRESET_IDS,
		},
		{
			id: 'shuffle_loop',
			name: 'Shuffle & loop',
			definitions: SHUFFLE_LOOP_PRESET_IDS,
		},
		{
			id: 'volume',
			name: 'Volume',
			definitions: VOLUME_PRESET_IDS,
		},
		{
			id: 'now_playing',
			name: 'Now playing',
			definitions: NOW_PLAYING_PRESET_IDS,
		},
	]

	self.setPresetDefinitions(structure, {
		...TransportPresets(),
		...ShuffleLoopPresets(),
		...VolumePresets(),
		...NowPlayingPresets(self),
	})
}

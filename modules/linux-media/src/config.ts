import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	/** 'auto' or the MPRIS name suffix, e.g. 'spotify' */
	player: string
	/** Empty = unix:path=$XDG_RUNTIME_DIR/bus */
	busAddress: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'player',
			label: 'Player (auto, or MPRIS name such as spotify)',
			width: 6,
			default: 'auto',
		},
		{
			type: 'textinput',
			id: 'busAddress',
			label: 'D-Bus address (empty = session bus)',
			width: 6,
			default: '',
		},
	]
}

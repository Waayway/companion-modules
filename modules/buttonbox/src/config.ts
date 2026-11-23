import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	/** Empty = $XDG_RUNTIME_DIR/companion-buttonbox.sock */
	socketPath: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'socketPath',
			label: 'Socket path (empty = $XDG_RUNTIME_DIR/companion-buttonbox.sock)',
			width: 12,
			default: '',
		},
	]
}

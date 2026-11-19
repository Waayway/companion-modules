import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	/** Empty = $HOME/.config/MangoHud */
	configDir: string
	/** MangoHud control socket name (control=<name> in MangoHud.conf) */
	controlSocket: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'configDir',
			label: 'MangoHud config folder (empty = ~/.config/MangoHud)',
			width: 8,
			default: '',
		},
		{
			type: 'textinput',
			id: 'controlSocket',
			label: 'Control socket name',
			width: 4,
			default: 'mangohud',
		},
	]
}

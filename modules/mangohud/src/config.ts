import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	/** Empty = $HOME/.config/MangoHud */
	configDir: string
	/** MangoHud control socket name (control=<name> in MangoHud.conf) */
	controlSocket: string
	/** Comma separated preset numbers in cycle order, e.g. "1,2,0" */
	cycleOrder: string
	/** Comma separated preset=label pairs, e.g. "0=Off,1=Bar,2=Detail" */
	presetLabels: string
	/** Also write the preset= line to per-app config files that already have one */
	updatePerAppConfigs: boolean
	/** D-Bus session bus address override. Empty = unix:path=$XDG_RUNTIME_DIR/bus */
	busAddress: string
	/** Sensor poll interval in milliseconds, minimum 500 */
	sensorPollMs: number
	/** Gamescope status poll interval in milliseconds, minimum 500 */
	gamescopePollMs: number
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
			label: 'Control socket name (control=<name> in MangoHud.conf)',
			width: 4,
			default: 'mangohud',
		},
		{
			type: 'textinput',
			id: 'cycleOrder',
			label: 'Preset cycle order (comma separated preset numbers)',
			width: 6,
			default: '1,2,0',
		},
		{
			type: 'textinput',
			id: 'presetLabels',
			label: 'Preset labels (comma separated number=label pairs)',
			width: 8,
			default: '0=Off,1=Bar,2=Detail',
		},
		{
			type: 'checkbox',
			id: 'updatePerAppConfigs',
			label: 'Also update per-app configs',
			width: 4,
			default: true,
		},
		{
			type: 'textinput',
			id: 'busAddress',
			label: 'D-Bus session bus address (empty = unix:path=$XDG_RUNTIME_DIR/bus)',
			width: 8,
			default: '',
		},
		{
			type: 'number',
			id: 'sensorPollMs',
			label: 'Sensor poll interval (ms)',
			width: 4,
			default: 2000,
			min: 500,
			max: 60_000,
		},
		{
			type: 'number',
			id: 'gamescopePollMs',
			label: 'Gamescope status poll interval (ms)',
			width: 4,
			default: 2000,
			min: 500,
			max: 60_000,
		},
	]
}

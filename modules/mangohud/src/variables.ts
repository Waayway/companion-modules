import type ModuleInstance from './main.js'

export type VariablesSchema = {
	preset: string
	preset_name: string
	mangohud_version: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		preset: { name: 'Current preset number' },
		preset_name: { name: 'Current preset label' },
		mangohud_version: { name: 'MangoHud version (from the control socket handshake)' },
	})
}

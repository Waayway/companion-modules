import type ModuleInstance from './main.js'

export type VariablesSchema = {
	preset: string
	preset_name: string
	mangohud_version: string
	gamemode: string
	cpu_temp: string
	gpu_temp: string
	gpu_load: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		preset: { name: 'Current preset number' },
		preset_name: { name: 'Current preset label' },
		mangohud_version: { name: 'MangoHud version (from the control socket handshake)' },
		gamemode: { name: 'GameMode active (on/off)' },
		cpu_temp: { name: 'CPU temperature (°C), "-" if the sensor was not found' },
		gpu_temp: { name: 'GPU temperature (°C), "-" if the sensor was not found' },
		gpu_load: { name: 'GPU load (%), "-" if the sensor was not found' },
	})
}

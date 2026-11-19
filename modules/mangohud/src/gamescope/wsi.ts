/** ENABLE_GAMESCOPE_WSI: "0" means off, anything else or unset means on. */
export function parseWsiEnabled(value: string | undefined): boolean {
	return value !== '0'
}

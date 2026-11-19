export interface ParsedHandshake {
	controlVersion?: string
	deviceName?: string
	mangoHudVersion?: string
}

/** Server handshake looks like `:MangoHudControlVersion=1;:DeviceName=foo;:MangoHudVersion=0.8;`. */
export function parseHandshake(raw: string): ParsedHandshake {
	const result: ParsedHandshake = {}
	const controlVersion = /:MangoHudControlVersion=([^;]*);/.exec(raw)
	const deviceName = /:DeviceName=([^;]*);/.exec(raw)
	const mangoHudVersion = /:MangoHudVersion=([^;]*);/.exec(raw)
	if (controlVersion) result.controlVersion = controlVersion[1]
	if (deviceName) result.deviceName = deviceName[1]
	if (mangoHudVersion) result.mangoHudVersion = mangoHudVersion[1]
	return result
}

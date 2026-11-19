import type { LogLevel } from '@companion-module/base'
import type { PlayerConnection } from '../mpris/player.js'
import { errorMessage } from '../errorMessage.js'

/**
 * The surface of `ModuleInstance` the action definitions depend on. Kept as a narrow interface (rather
 * than importing the concrete class) so tests can exercise actions against a lightweight fake module.
 */
export interface ActionModuleContext {
	log(level: LogLevel, message: string): void
	getSelectedPlayerConnection(): PlayerConnection | null
	setPlayerOverride(player: string | null): void
}

/**
 * Runs `fn` against the currently selected player's connection. Does nothing but a debug log when no
 * player is selected, and never throws into Companion: a D-Bus failure (including a player that rejects
 * the call, e.g. one without volume control) is caught and logged at warn level.
 */
export async function withSelectedPlayer(
	self: ActionModuleContext,
	actionName: string,
	fn: (connection: PlayerConnection) => Promise<void>,
): Promise<void> {
	const connection = self.getSelectedPlayerConnection()
	if (!connection) {
		self.log('debug', `${actionName}: no player selected, ignoring`)
		return
	}
	try {
		await fn(connection)
	} catch (err) {
		self.log('warn', `${actionName} failed: ${errorMessage(err)}`)
	}
}

import type { ClientInterface } from '@particle/dbus-next'
import { MPRIS_NAME_PREFIX } from './selector.js'

/** True for well-known D-Bus names that identify an MPRIS media player. */
export function isMprisPlayerName(name: string): boolean {
	return name.startsWith(MPRIS_NAME_PREFIX) && name.length > MPRIS_NAME_PREFIX.length
}

/** Lists the MPRIS player names currently on the bus, via `org.freedesktop.DBus.ListNames`. */
export async function listMprisPlayerNames(dbusInterface: ClientInterface): Promise<string[]> {
	const names = await dbusInterface.ListNames<string[]>()
	return names.filter(isMprisPlayerName)
}

export type NameOwnerChange = {
	name: string
	oldOwner: string
	newOwner: string
}

/** Subscribes to `NameOwnerChanged` for MPRIS names only. Returns an unsubscribe function. */
export function watchNameOwnerChanges(
	dbusInterface: ClientInterface,
	onChange: (change: NameOwnerChange) => void,
): () => void {
	const listener = (name: string, oldOwner: string, newOwner: string): void => {
		if (!isMprisPlayerName(name)) return
		onChange({ name, oldOwner, newOwner })
	}
	dbusInterface.on('NameOwnerChanged', listener)
	return () => dbusInterface.off('NameOwnerChanged', listener)
}

import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const TIMEOUT_MS = 1000

interface HyprMonitor {
	name: string
	refreshRate: number
	focused: boolean
}

/**
 * Hyprland's request sockets ($XDG_RUNTIME_DIR/hypr/<instance>/.socket.sock), newest first.
 * HYPRLAND_INSTANCE_SIGNATURE isn't in the environment Companion gives a module, so scan.
 */
export function findHyprlandSockets(runtimeDir: string | undefined): string[] {
	if (!runtimeDir) return []
	const hyprDir = path.join(runtimeDir, 'hypr')
	let entries: string[]
	try {
		entries = fs.readdirSync(hyprDir)
	} catch {
		return []
	}
	const sockets: { socket: string; mtime: number }[] = []
	for (const entry of entries) {
		const socket = path.join(hyprDir, entry, '.socket.sock')
		try {
			sockets.push({ socket, mtime: fs.statSync(path.join(hyprDir, entry)).mtimeMs })
		} catch {
			// not an instance dir
		}
	}
	return sockets.sort((a, b) => b.mtime - a.mtime).map((s) => s.socket)
}

async function request(socket: string, command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		const conn = net.createConnection(socket, () => conn.end(command))
		conn.setTimeout(TIMEOUT_MS, () => conn.destroy(new Error('Hyprland IPC timed out')))
		conn.on('data', (chunk: Buffer) => chunks.push(chunk))
		conn.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
		conn.on('error', reject)
	})
}

/**
 * The refresh rate (Hz, rounded) of the monitor gamescope shows on: the first of its preferred
 * outputs (-O, comma-separated) that Hyprland has, else Hyprland's focused monitor. null when
 * not on Hyprland or nothing matches.
 */
export async function readHyprlandRefresh(
	preferredOutputs: string[],
	runtimeDir: string | undefined = process.env.XDG_RUNTIME_DIR,
): Promise<number | null> {
	for (const socket of findHyprlandSockets(runtimeDir)) {
		let monitors: HyprMonitor[]
		try {
			monitors = JSON.parse(await request(socket, 'j/monitors')) as HyprMonitor[]
		} catch {
			continue
		}
		return pickRefresh(monitors, preferredOutputs)
	}
	return null
}

export function pickRefresh(monitors: HyprMonitor[], preferredOutputs: string[]): number | null {
	const monitor =
		preferredOutputs.map((name) => monitors.find((m) => m.name === name)).find((m) => m !== undefined) ??
		monitors.find((m) => m.focused)
	if (!monitor || !Number.isFinite(monitor.refreshRate) || monitor.refreshRate <= 0) return null
	return Math.round(monitor.refreshRate)
}

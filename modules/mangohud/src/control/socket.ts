import net from 'node:net'

export interface ControlResult {
	handshake: string
}

async function connectAndWaitForHandshake(
	socketName: string,
	timeoutMs: number,
): Promise<{ socket: net.Socket; handshake: string }> {
	return new Promise((resolve, reject) => {
		const socket = net.connect('\0' + socketName)
		let settled = false

		const timer = setTimeout(() => {
			if (settled) return
			settled = true
			socket.destroy()
			reject(new Error(`Timed out waiting for the MangoHud control handshake on socket "${socketName}"`))
		}, timeoutMs)

		socket.once('error', (err) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			reject(err)
		})

		socket.once('data', (data) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			resolve({ socket, handshake: data.toString('utf8') })
		})
	})
}

/** Connect, wait for the handshake, send one command, close. MangoHud serves one client at a time. */
export async function sendControlCommand(
	socketName: string,
	command: string,
	timeoutMs = 1000,
): Promise<ControlResult> {
	const { socket, handshake } = await connectAndWaitForHandshake(socketName, timeoutMs)
	await new Promise<void>((resolve) => socket.end(command, () => resolve()))
	return { handshake }
}

/** Same connect/handshake/close dance, but sends nothing: a cheap reachability probe. */
export async function probeControlSocket(socketName: string, timeoutMs = 1000): Promise<ControlResult> {
	const { socket, handshake } = await connectAndWaitForHandshake(socketName, timeoutMs)
	await new Promise<void>((resolve) => socket.end(() => resolve()))
	return { handshake }
}

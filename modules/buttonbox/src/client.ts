import net from 'node:net'

const RETRY_MS = 2000

/**
 * Talks to the companion-buttonbox daemon: one line per event (`down <n>` / `up <n>`), no replies.
 * Keeps retrying while the daemon is away. Sends while disconnected are dropped on purpose: a stale
 * "down" arriving after a reconnect would leave a button stuck.
 */
export class ButtonBoxClient {
	private socket: net.Socket | undefined
	private timer: NodeJS.Timeout | undefined
	private connected = false
	private destroyed = false

	constructor(
		private readonly path: string,
		private readonly onStatus: (connected: boolean) => void,
	) {}

	start(): void {
		this.onStatus(false)
		this.connect()
	}

	send(cmd: 'down' | 'up', n: number): void {
		if (!this.connected || !this.socket) return
		this.socket.write(`${cmd} ${n}\n`)
	}

	destroy(): void {
		this.destroyed = true
		clearTimeout(this.timer)
		this.socket?.destroy()
		this.socket = undefined
		this.connected = false
	}

	private connect(): void {
		if (this.destroyed) return
		const socket = net.createConnection(this.path)
		this.socket = socket
		socket.on('connect', () => {
			this.connected = true
			this.onStatus(true)
		})
		// the daemon never replies; swallow anything and errors (handled by 'close')
		socket.on('data', () => {})
		socket.on('error', () => {})
		socket.on('close', () => {
			const wasConnected = this.connected
			this.connected = false
			if (this.socket === socket) this.socket = undefined
			if (this.destroyed) return
			if (wasConnected) this.onStatus(false)
			this.timer = setTimeout(() => this.connect(), RETRY_MS)
		})
	}
}

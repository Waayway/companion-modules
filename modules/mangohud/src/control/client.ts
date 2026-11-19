import { sendControlCommand, probeControlSocket } from './socket.js'
import { HUD_COMMAND, FCAT_COMMAND, loggingCommand } from './commands.js'
import { parseHandshake } from './handshake.js'
import { createReachabilityChecker, type ReachabilityChecker } from './reachable.js'

export interface ControlClientHost {
	setVariableValues(values: Partial<Record<'mangohud_version', string>>): void
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

/** Wraps the abstract control socket: send-and-close per action, with a cached reachability probe. */
export class ControlClient {
	private socketName = 'mangohud'
	private readonly checkReachable: ReachabilityChecker

	constructor(
		private readonly host: ControlClientHost,
		probe = probeControlSocket,
	) {
		this.checkReachable = createReachabilityChecker(probe)
	}

	configure(socketName: string): void {
		this.socketName = socketName
	}

	async toggleHud(): Promise<void> {
		await this.send(HUD_COMMAND)
	}

	async setLogging(state?: 0 | 1): Promise<void> {
		await this.send(loggingCommand(state))
	}

	async toggleFcat(): Promise<void> {
		await this.send(FCAT_COMMAND)
	}

	async isReachable(): Promise<boolean> {
		return this.checkReachable(this.socketName)
	}

	private async send(command: string): Promise<void> {
		try {
			const { handshake } = await sendControlCommand(this.socketName, command)
			const parsed = parseHandshake(handshake)
			if (parsed.mangoHudVersion) {
				this.host.setVariableValues({ mangohud_version: parsed.mangoHudVersion })
			}
		} catch (err) {
			const error = err as NodeJS.ErrnoException
			if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
				this.host.log(
					'warn',
					`MangoHud control socket "${this.socketName}" is not reachable. Add control=${this.socketName} to MangoHud.conf.`,
				)
			} else {
				this.host.log('error', `MangoHud control socket error: ${error.message}`)
			}
		}
	}
}

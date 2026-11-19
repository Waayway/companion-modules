import dbus from '@particle/dbus-next'
import type { MessageBus } from '@particle/dbus-next'

const { Interface, ACCESS_READ, ACCESS_READWRITE } = dbus.interface

export type FakePlayerInitialState = {
	playbackStatus?: string
	volume?: number
	shuffle?: boolean
	loopStatus?: string
	position?: bigint
	title?: string
	artist?: string[]
	album?: string
	lengthMicroseconds?: bigint
	artUrl?: string
}

/**
 * A minimal `org.mpris.MediaPlayer2.Player` implementation for tests, adapted from
 * `docs/notes/spikes/fake-player.mjs` with the properties and methods the media module relies on.
 */
class FakePlayerInterface extends dbus.interface.Interface {
	playbackStatus: string
	volume: number
	shuffle: boolean
	loopStatus: string
	position: bigint
	title: string
	artist: string[]
	album: string
	lengthMicroseconds: bigint
	artUrl: string
	playPauseCalls = 0
	nextCalls = 0
	previousCalls = 0
	stopCalls = 0

	constructor(initial: FakePlayerInitialState) {
		super('org.mpris.MediaPlayer2.Player')
		this.playbackStatus = initial.playbackStatus ?? 'Stopped'
		this.volume = initial.volume ?? 1
		this.shuffle = initial.shuffle ?? false
		this.loopStatus = initial.loopStatus ?? 'None'
		this.position = initial.position ?? 0n
		this.title = initial.title ?? 'Fake title'
		this.artist = initial.artist ?? ['Fake artist']
		this.album = initial.album ?? 'Fake album'
		this.lengthMicroseconds = initial.lengthMicroseconds ?? 180_000_000n
		this.artUrl = initial.artUrl ?? 'file:///tmp/fake-art.png'
	}

	PlayPause(): void {
		this.playPauseCalls += 1
		this.playbackStatus = this.playbackStatus === 'Playing' ? 'Paused' : 'Playing'
		Interface.emitPropertiesChanged(this, { PlaybackStatus: this.playbackStatus }, [])
	}

	Next(): void {
		this.nextCalls += 1
	}

	Previous(): void {
		this.previousCalls += 1
	}

	Stop(): void {
		this.stopCalls += 1
		this.playbackStatus = 'Stopped'
		Interface.emitPropertiesChanged(this, { PlaybackStatus: this.playbackStatus }, [])
	}

	get PlaybackStatus(): string {
		return this.playbackStatus
	}

	get Volume(): number {
		return this.volume
	}

	set Volume(value: number) {
		this.volume = value
		Interface.emitPropertiesChanged(this, { Volume: value }, [])
	}

	get Shuffle(): boolean {
		return this.shuffle
	}

	set Shuffle(value: boolean) {
		this.shuffle = value
		Interface.emitPropertiesChanged(this, { Shuffle: value }, [])
	}

	get LoopStatus(): string {
		return this.loopStatus
	}

	set LoopStatus(value: string) {
		this.loopStatus = value
		Interface.emitPropertiesChanged(this, { LoopStatus: value }, [])
	}

	get Position(): bigint {
		return this.position
	}

	get Metadata(): Record<string, InstanceType<typeof dbus.Variant>> {
		return {
			'xesam:title': new dbus.Variant('s', this.title),
			'xesam:artist': new dbus.Variant('as', this.artist),
			'xesam:album': new dbus.Variant('s', this.album),
			'mpris:length': new dbus.Variant('x', this.lengthMicroseconds),
			'mpris:artUrl': new dbus.Variant('s', this.artUrl),
		}
	}

	/** Test helper: push a playback status change as a real player would, e.g. after an external seek. */
	setPlaybackStatus(status: string): void {
		this.playbackStatus = status
		Interface.emitPropertiesChanged(this, { PlaybackStatus: status }, [])
	}

	/** Test helper: push a metadata change, e.g. a track change. */
	setTitle(title: string): void {
		this.title = title
		Interface.emitPropertiesChanged(this, { Metadata: this.Metadata }, [])
	}
}

FakePlayerInterface.configureMembers({
	properties: {
		PlaybackStatus: { signature: 's', access: ACCESS_READ },
		Volume: { signature: 'd', access: ACCESS_READWRITE },
		Shuffle: { signature: 'b', access: ACCESS_READWRITE },
		LoopStatus: { signature: 's', access: ACCESS_READWRITE },
		Position: { signature: 'x', access: ACCESS_READ },
		Metadata: { signature: 'a{sv}', access: ACCESS_READ },
	},
	methods: {
		PlayPause: { inSignature: '', outSignature: '' },
		Next: { inSignature: '', outSignature: '' },
		Previous: { inSignature: '', outSignature: '' },
		Stop: { inSignature: '', outSignature: '' },
	},
})

export type FakePlayer = {
	busName: string
	interface: FakePlayerInterface
	disconnect: () => Promise<void>
}

/** Requests `org.mpris.MediaPlayer2.<suffix>` on `bus` and exports a fake `Player` interface there. */
export async function startFakePlayer(
	bus: MessageBus,
	suffix: string,
	initial: FakePlayerInitialState = {},
): Promise<FakePlayer> {
	const busName = `org.mpris.MediaPlayer2.${suffix}`
	const playerInterface = new FakePlayerInterface(initial)
	await bus.requestName(busName, 0)
	bus.export('/org/mpris/MediaPlayer2', playerInterface)
	return {
		busName,
		interface: playerInterface,
		disconnect: async () => {
			bus.unexport('/org/mpris/MediaPlayer2', playerInterface)
			await bus.releaseName(busName)
		},
	}
}

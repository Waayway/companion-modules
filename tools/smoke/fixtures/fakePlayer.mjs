// Adapted from docs/notes/spikes/fake-player.mjs, with the properties/methods and call counters
// the linux-media module relies on (same shape as modules/linux-media/src/mpris/fixtures/fakePlayer.ts,
// reimplemented here in plain JS so this standalone tool doesn't depend on any module's node_modules).
import dbus from '@particle/dbus-next'

const { Interface, ACCESS_READ, ACCESS_READWRITE } = dbus.interface

class FakePlayerInterface extends Interface {
	constructor(initial) {
		super('org.mpris.MediaPlayer2.Player')
		this.playbackStatus = initial.playbackStatus ?? 'Stopped'
		this.volume = initial.volume ?? 1
		this.shuffle = initial.shuffle ?? false
		this.loopStatus = initial.loopStatus ?? 'None'
		this.title = initial.title ?? 'Fake title'
		this.artist = initial.artist ?? ['Fake artist']
		this.album = initial.album ?? 'Fake album'
		this.lengthMicroseconds = initial.lengthMicroseconds ?? 180_000_000n
		this.playCalls = 0
		this.pauseCalls = 0
		this.playPauseCalls = 0
		this.nextCalls = 0
		this.previousCalls = 0
		this.stopCalls = 0
	}

	Play() {
		this.playCalls += 1
		this.playbackStatus = 'Playing'
		Interface.emitPropertiesChanged(this, { PlaybackStatus: this.playbackStatus }, [])
	}

	Pause() {
		this.pauseCalls += 1
		this.playbackStatus = 'Paused'
		Interface.emitPropertiesChanged(this, { PlaybackStatus: this.playbackStatus }, [])
	}

	PlayPause() {
		this.playPauseCalls += 1
		this.playbackStatus = this.playbackStatus === 'Playing' ? 'Paused' : 'Playing'
		Interface.emitPropertiesChanged(this, { PlaybackStatus: this.playbackStatus }, [])
	}

	Next() {
		this.nextCalls += 1
	}

	Previous() {
		this.previousCalls += 1
	}

	Stop() {
		this.stopCalls += 1
		this.playbackStatus = 'Stopped'
		Interface.emitPropertiesChanged(this, { PlaybackStatus: this.playbackStatus }, [])
	}

	get PlaybackStatus() {
		return this.playbackStatus
	}

	get Volume() {
		return this.volume
	}

	set Volume(value) {
		this.volume = value
		Interface.emitPropertiesChanged(this, { Volume: value }, [])
	}

	get Shuffle() {
		return this.shuffle
	}

	set Shuffle(value) {
		this.shuffle = value
		Interface.emitPropertiesChanged(this, { Shuffle: value }, [])
	}

	get LoopStatus() {
		return this.loopStatus
	}

	set LoopStatus(value) {
		this.loopStatus = value
		Interface.emitPropertiesChanged(this, { LoopStatus: value }, [])
	}

	get Metadata() {
		return {
			'xesam:title': new dbus.Variant('s', this.title),
			'xesam:artist': new dbus.Variant('as', this.artist),
			'xesam:album': new dbus.Variant('s', this.album),
			'mpris:length': new dbus.Variant('x', this.lengthMicroseconds),
		}
	}
}

FakePlayerInterface.configureMembers({
	properties: {
		PlaybackStatus: { signature: 's', access: ACCESS_READ },
		Volume: { signature: 'd', access: ACCESS_READWRITE },
		Shuffle: { signature: 'b', access: ACCESS_READWRITE },
		LoopStatus: { signature: 's', access: ACCESS_READWRITE },
		Metadata: { signature: 'a{sv}', access: ACCESS_READ },
	},
	methods: {
		Play: { inSignature: '', outSignature: '' },
		Pause: { inSignature: '', outSignature: '' },
		PlayPause: { inSignature: '', outSignature: '' },
		Next: { inSignature: '', outSignature: '' },
		Previous: { inSignature: '', outSignature: '' },
		Stop: { inSignature: '', outSignature: '' },
	},
})

/** Requests `org.mpris.MediaPlayer2.<suffix>` on a fresh bus connection and exports a fake Player there. */
export async function startFakePlayer(busAddress, suffix, initial = {}) {
	const bus = dbus.sessionBus({ busAddress })
	const busName = `org.mpris.MediaPlayer2.${suffix}`
	const iface = new FakePlayerInterface(initial)
	await bus.requestName(busName, 0)
	bus.export('/org/mpris/MediaPlayer2', iface)
	return {
		busName,
		interface: iface,
		async disconnect() {
			bus.unexport('/org/mpris/MediaPlayer2', iface)
			await bus.releaseName(busName)
			bus.disconnect()
		},
	}
}

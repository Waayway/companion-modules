// Adapted from docs/notes/spikes/sock.mjs: a MangoHud-style abstract control socket that records
// the raw bytes of every command it receives, so a test can assert on the exact wire protocol
// (see modules/mangohud/src/control/commands.ts, e.g. HUD_COMMAND = ':hud;').
import net from 'node:net'

export function startFakeControlSocket(name) {
	const received = []
	const server = net.createServer((socket) => {
		socket.write(':MangoHudControlVersion=1;:DeviceName=fake;:MangoHudVersion=0.8;')
		socket.on('data', (data) => received.push(data.toString('utf8')))
	})

	return new Promise((resolve, reject) => {
		server.once('error', reject)
		server.listen('\0' + name, () => {
			resolve({
				received,
				close: () => new Promise((r) => server.close(r)),
			})
		})
	})
}

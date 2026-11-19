import net from 'node:net'
const srv = net
	.createServer((s) => {
		s.write(':MangoHudControlVersion=1;:DeviceName=fake;:MangoHudVersion=0.8;')
		s.on('data', (d) => console.log('[srv] got', JSON.stringify(d.toString())))
	})
	.listen('\0mangohud-spike')
setTimeout(() => srv.close(), 6000)

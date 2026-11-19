import net from 'node:net'
import fs from 'node:fs'
const c = net.connect('\0mangohud-spike')
c.on('data', (d) => {
	console.log('[cli] handshake', d.toString())
	c.write(':hud;:logging=1;')
	setTimeout(() => {
		c.end()
		const tests = {
			'read ~/.config/MangoHud': () => fs.readFileSync(process.env.HOME + '/.config/MangoHud/MangoHud.conf', 'utf8'),
			'write conf': () => fs.writeFileSync(process.env.HOME + '/x.tmp', 'a'),
			'fs.watch dir': () => fs.watch(process.env.HOME + '/.config').close(),
			'read /proc/net/unix': () => fs.readFileSync('/proc/net/unix', 'utf8').length,
		}
		for (const [n, f] of Object.entries(tests)) {
			try { f(); console.log(n, '-> ALLOWED') } catch (e) { console.log(n, '->', e.code) }
		}
		process.exit(0)
	}, 300)
})

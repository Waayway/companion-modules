import dbus from '@particle/dbus-next'
const addr = process.env.DBUS_SESSION_BUS_ADDRESS
const bus = dbus.sessionBus({busAddress: addr})
const names = (await (await bus.getProxyObject('org.freedesktop.DBus','/org/freedesktop/DBus')).getInterface('org.freedesktop.DBus').ListNames()).filter(n=>n.startsWith('org.mpris.MediaPlayer2.'))
console.log('players:',names)
const obj = await bus.getProxyObject(names[0],'/org/mpris/MediaPlayer2')
const props = obj.getInterface('org.freedesktop.DBus.Properties')
const player = obj.getInterface('org.mpris.MediaPlayer2.Player')
props.on('PropertiesChanged',(iface,changed)=>console.log('[client] changed',iface,Object.fromEntries(Object.entries(changed).map(([k,v])=>[k,v.value]))))
const md = (await props.Get('org.mpris.MediaPlayer2.Player','Metadata')).value
console.log('title:',md['xesam:title'].value,'artist:',md['xesam:artist'].value)
await player.PlayPause()
await props.Set('org.mpris.MediaPlayer2.Player','Volume', new dbus.Variant('d',0.8))
setTimeout(()=>process.exit(0),500)

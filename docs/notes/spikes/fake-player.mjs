import dbus from '@particle/dbus-next'
const { Interface, ACCESS_READ, ACCESS_READWRITE } = dbus.interface
class Player extends Interface {
  constructor(){ super('org.mpris.MediaPlayer2.Player'); this._s='Playing'; this._v=0.5 }
  PlayPause(){ this._s = this._s==='Playing'?'Paused':'Playing'; Interface.emitPropertiesChanged(this,{PlaybackStatus:this._s}); console.log('[player] PlayPause ->',this._s) }
  Next(){ console.log('[player] Next') }
  get PlaybackStatus(){return this._s}
  get Volume(){return this._v}
  set Volume(v){this._v=v; Interface.emitPropertiesChanged(this,{Volume:v})}
  get Metadata(){return {'xesam:title':new dbus.Variant('s','Fake Song'),'xesam:artist':new dbus.Variant('as',['Fake Artist'])}}
}
Player.configureMembers({properties:{PlaybackStatus:{signature:'s',access:ACCESS_READ},Volume:{signature:'d',access:ACCESS_READWRITE},Metadata:{signature:'a{sv}',access:ACCESS_READ}},methods:{PlayPause:{inSignature:'',outSignature:''},Next:{inSignature:'',outSignature:''}}})
const bus = dbus.sessionBus()
await bus.requestName('org.mpris.MediaPlayer2.fake', 0)
bus.export('/org/mpris/MediaPlayer2', new Player())
console.log('[player] up')
setTimeout(()=>{},8000)

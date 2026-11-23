## Button box

Presses buttons on a virtual joystick ("Companion Button Box", 32 buttons) so a game sees Stream
Deck keys as joystick buttons. It needs the `companion-buttonbox` daemon running in the same user
session; the module only talks to the daemon's Unix socket.

### Setup

Leave "Socket path" empty to use `$XDG_RUNTIME_DIR/companion-buttonbox.sock`. The status is OK
while the daemon is reachable and Disconnected otherwise; the module reconnects every 2 seconds.

### Actions

- **Press**: holds joystick button 1-32 down (use with Release on key up).
- **Release**: lets go of the button.
- **Tap**: presses, waits about 80 ms and releases.

Presses sent while the daemon is not reachable are dropped, never replayed later. If Companion
disconnects while a button is held, the daemon releases it.

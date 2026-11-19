## Linux media (MPRIS)

Controls any MPRIS media player (Spotify, mpv, browsers, ...) over the D-Bus session bus.
No helper program or HTTP bridge is needed. The module connects event-driven: it lists the
players already on the bus, then watches for players appearing/vanishing and for their
property changes. No player running is not an error.

### Configuration

- **Player**: `auto` (default) follows the playing player, or the most recently active one if
  none is playing, or the first one if none has been active; or a specific MPRIS name such as
  `spotify` or `mpv` to always track that player (it never falls back to `auto`). The "Select
  player" action can override this at runtime without changing the saved config; set it back to
  `auto` to clear the override.
- **D-Bus address**: leave empty to use `unix:path=$XDG_RUNTIME_DIR/bus` (the session bus).
  Companion does not forward `DBUS_SESSION_BUS_ADDRESS` to modules, so only set this if your
  session bus lives somewhere else.

### Actions

- Play, Pause, Play/Pause, Stop, Next, Previous
- Shuffle: toggle, or force on/off
- Loop: cycle None -> Playlist -> Track -> None, or set a specific mode
- Volume up / down (step %, default 5), Volume set (%)
- Seek relative (seconds; negative seeks backward), via MPRIS `Seek`
- Select player: `auto`, or an MPRIS name such as `spotify`

Every action targets the currently selected player. With no player selected, it does nothing
(logged at debug level). A player that rejects a call (see Known limits) cannot crash the
module: the error is caught and logged at warn level.

### Feedbacks

- Playing, Paused, Stopped (boolean)
- Shuffle is on (boolean)
- Loop mode is \<mode\> (boolean, option: None/Playlist/Track)
- Player available (boolean: is a player currently selected)
- Player is \<name\> (boolean, option: matches the MPRIS name suffix, e.g. `spotify`)

### Variables

`status`, `player`, `artist`, `title`, `album`, `volume` (%), `shuffle` (on/off), `loop`
(None/Playlist/Track), `position` (s), `length` (s), `players` (count on the bus). With nothing
selected: `status` is `Stopped`, `title` is `Nothing playing`, and the rest show `-` or `0`.

### Known limits

- Not every player implements every MPRIS property or method. A player without volume control
  simply ignores a volume action (logged at warn level, nothing crashes); the same applies to
  players that don't report `Shuffle` or `LoopStatus` at all, where the module falls back to
  `off` / `None`.
- `position` is polled once a second while the selected player is `Playing` (MPRIS does not push
  position changes). It is not updated while paused or stopped.
- Titles are not truncated by the module; use a Companion expression on the button if you need
  that.

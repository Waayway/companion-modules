# Linux desktop integrations without HTTP or child processes

Status tags: [verified] = ran in a spike; [source] = read from upstream source only; [untested].

## Media (MPRIS over D-Bus) [verified]
- Pure-JS client `@particle/dbus-next` (maintained fork of dbus-next; deps pure JS). Original `dbus-next` is
  unmaintained since 2022 and pulls an optional native `usocket`.
- Works: `ListNames` filter `org.mpris.MediaPlayer2.*`, `Properties.Get` (Metadata is `a{sv}`, artist is `as`),
  `PropertiesChanged` events, `Player.PlayPause/Next/...`, `Properties.Set` of Volume (`new Variant('d', 0.8)`).
- Pass `busAddress` explicitly (see env note in SKILL.md). Subscribe to `NameOwnerChanged` for players coming/going.
- Test rig: `dbus-run-session -- bash run.sh` with a fake player. Service-side member options use `signature`
  (not `type`) in `configureMembers`.

## System volume / mic mute [untested]
- PipeWire has no D-Bus API. Candidate: `pulseaudio.js` (pure JS PulseAudio native protocol) against
  pipewire-pulse socket `$XDG_RUNTIME_DIR/pulse/native`; cookie auth may need the `filesystem` permission.

## MangoHud [verified socket / source for the rest]
- Control socket = **abstract** Unix socket `\0<name>` enabled by `control=<name>` in MangoHud.conf (`%p` = pid).
  Node `net.connect('\0name')` works under the permission model.
- Protocol: send `:hud;` `:logging[=0|1];` `:fcat;`. Server sends handshake `:MangoHudControlVersion=..;
  :DeviceName=..;:MangoHudVersion=..;`. No state readback, one client at a time => connect per action, then close.
- **No preset command.** Preset switching = rewrite `preset=a,b,c` in the config (first entry = current).
  MangoHud reloads via inotify on the file it loaded (re-arms after rename-replace). Needs `filesystem` permission.
- Per-app files (`~/.config/MangoHud/<exe>.conf`, `wine-<exe>.conf`) override `MangoHud.conf`, and only the loaded
  file is watched => edit/watch the active file or switches silently do nothing for those games.
  `MANGOHUD_CONFIG` env overrides everything and can't be changed at runtime.

## gamemode [source]
- D-Bus `com.feralinteractive.GameMode` at `/com/feralinteractive/GameMode`: property `ClientCount`,
  `ListGames`, signals `GameRegistered`/`GameUnregistered`. Active = ClientCount > 0.

## gamescope status [source]
- Atoms on gamescope's Xwayland root window: `GAMESCOPE_VRR_FEEDBACK`, `GAMESCOPE_HDR_OUTPUT_FEEDBACK`,
  `GAMESCOPE_DISPLAY_HDR_ENABLED`, `GAMESCOPE_VRR_ENABLED`. Pure-JS X11 client: npm `x11`. Finding the display
  needs `/proc/<pid>/environ` (`DISPLAY`, `ENABLE_GAMESCOPE_WSI`) => `filesystem` permission.

## Hardware sensors [source]
- CPU temp: `/sys/class/hwmon/*/name` in {k10temp, zenpower} `temp1_input`; GPU: `amdgpu` hwmon +
  `/sys/class/drm/card*/device/gpu_busy_percent`. `filesystem` permission.

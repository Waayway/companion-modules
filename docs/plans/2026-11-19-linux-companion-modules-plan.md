# Linux Companion modules: media + MangoHud

Status: draft for review. Nothing is built. Date: 2026-11-19.

## 1. Summary

Replace the "Generic HTTP module + `mangocompanion.py` daemon" setup with two native Bitfocus
Companion connection modules, written in TypeScript on `@companion-module/base` (API 2.2,
Companion 5.1+, runtime `node26`):

- `linux-media`: any MPRIS player (Spotify, mpv, browsers, ...) over D-Bus.
- `mangohud`: MangoHud preset and HUD control, plus the "gaming status" lights
  (gamescope HDR/VRR/WSI/mode, gamemode, CPU/GPU temps and load).

No HTTP server, no localhost port, no Python, no `playerctl`/`wpctl` child processes.

## 2. Decisions

Decided by the owner (2026-11-19):

1. DECIDED: gamescope, gamemode and sensors live in the `mangohud` module (no third module).
2. DECIDED: no system volume / mic mute. The `linux-media` module is MPRIS only, which also
   removes the PipeWire/PulseAudio dependency that could not be tested.
3. DECIDED: repo `Waayway/companion-modules`, private, created through `gh` as Waayway.

Open items 4 to 8 were accepted as recommended on 2026-11-19 (see decisions.md):

4. Module ids. Recommended: `linux-media` and `mangohud`. The `generic-` prefix belongs to
   Bitfocus, so it is avoided.
5. Per-game MangoHud config files. Recommended: the preset actions write the same `preset=`
   line to `MangoHud.conf` and to every per-app `*.conf` in the config dir that already has a
   `preset=` line (option on by default). See 6.2.
6. Preset labels. Recommended: config fields "cycle order" (default `1,2,0`) and "label per
   preset number" (default `0=Off, 1=Bar, 2=Detail`), same as the old script, so your buttons
   keep their meaning.
7. License. Recommended: MIT, per Companion's convention.
8. Migration. Recommended: this plan covers new modules + presets only. Re-pointing your
   existing three pages is done by hand from the presets (Phase 5), not by rewriting the
   `.companionconfig`.

## 3. What exists today

From `wdesktop_2026-11-17-2202_custom_config.companionconfig` (Companion 5.1.3):

- Pages: MUSIC, MUSIC+CALL, GAMING (36 layered buttons).
- Connections: `generic-http` (3.2.0, label `bridge`), `discord-api` (1.5.1). Discord stays as is.
- 13 distinct HTTP calls to `127.0.0.1:8899`: `/music/{play-pause,next,previous,shuffle,loop,
  vol-up,vol-down,sys-mute,mic-mute}` and `/preset/{0,1,2,cycle}`.
- 21 custom variables pushed by the daemon every 2 s: `mp_*` (7), `sys_volume`, `sys_mute`,
  `mic_mute`, `cpu_temp`, `gpu_temp`, `gpu_load`, `mh_preset`, `mh_preset_name`, `gs_*` (5),
  `gamemode`. Buttons read them as `$(custom:...)` through `variable_value` feedbacks.
- `mangocompanion.py`: about 350 lines, polling, `playerctl`/`wpctl`/`xprop`/`gamemoded -s`
  child processes.

Dropped by decision 2: `sys-mute`, `mic-mute`, `sys-vol-*` actions and `sys_volume`,
`sys_mute`, `mic_mute` variables. The buttons using them are removed or replaced by hand.

## 4. Runtime constraints that shape the design

Verified against Companion `main` (`NodePath.ts`, `Environment.ts`) and a spike:

- Modules run as `node --permission --allow-net --allow-fs-read=<module dir>`. Network,
  including Unix and abstract sockets, is always allowed.
- Reads/writes elsewhere need `runtime.permissions.filesystem` in `manifest.json`
  (grants read+write `*`). Child processes are flagged to the user as dangerous: not used.
- Only `XDG_RUNTIME_DIR`, `HOME`, `TMP*` and proxy vars reach the module.
  `DBUS_SESSION_BUS_ADDRESS` does not, so the bus address is derived as
  `unix:path=$XDG_RUNTIME_DIR/bus` with a config override.
- Read access is limited to the module's own directory, so each module keeps its own
  `node_modules` (no hoisting to the repo root).
- Permissions are off while the inspector is attached: always retest without it.

Per module:

- `linux-media`: permissions `{}` (network only). Proven in the spike.
- `mangohud`: `filesystem` (config edit, `/proc`, `/sys`, `fs.watch`). Network for the control
  socket, X11 and D-Bus.

## 5. Scope

In: the two modules, their actions, feedbacks, variables, presets, HELP.md, tests, CI, and a
dev-folder install guide. Out: system audio, Companion store release, Windows/macOS,
Wayland-native MPRIS alternatives, PipeWire, rewriting the existing `.companionconfig`.

## 6. Target design

### 6.1 `linux-media`

Library: `@particle/dbus-next` (pure JS; maintained fork). Bus: session bus.

Config: player selection (`auto`, or a specific MPRIS name such as `spotify`, `mpv`), bus
address override, "prefer playing player" (default on).

Behaviour:

1. Connect, `ListNames`, filter `org.mpris.MediaPlayer2.*`.
2. Subscribe to `NameOwnerChanged` (players appearing/vanishing) and each tracked player's
   `PropertiesChanged`. Event driven, no polling. Position is the only value that needs a
   timer, and only if a position variable is used.
3. `auto` picks the playing player, else the most recently active, else the first.
4. Status: `Ok` when connected to the bus (no player is not an error), `ConnectionFailure`
   when the bus is unreachable, with retry and backoff.

Actions: play, pause, play/pause, stop, next, previous, toggle/set shuffle, cycle loop
(None, Playlist, Track), volume up/down/set (step configurable, default 5%), seek relative,
select player.

Feedbacks (boolean): playing, paused, shuffle on, loop mode is X, player available,
player is X.

Variables: `status`, `player`, `artist`, `title`, `album`, `volume`, `shuffle`, `loop`,
`position`, `length`, `players` (count). Titles are not truncated by the module; use
Companion expressions for that.

### 6.2 `mangohud`

Libraries: `@particle/dbus-next` (gamemode), `x11` (gamescope atoms); `net`/`fs` built in.

Config: MangoHud config dir (default `$HOME/.config/MangoHud`), preset cycle order, preset
labels (decision 6), control socket name (default `mangohud`), "also update per-app configs"
(decision 5), poll interval for sensors (default 2 s).

Preset control:

1. Read: parse `preset=` from the active file (first entry = current preset). `fs.watch` the
   directory so changes made by hand or by MangoHud's own keybind are reflected.
2. Write: atomic rename of the rewritten file, same as the old script
   (`preset=<n>,<others in cycle order>`). MangoHud's inotify watch re-arms after a rename
   (`IN_DELETE_SELF`, 100 ms delay; read from `notify.cpp`).
3. Known limits: `MANGOHUD_CONFIG` in a game's env overrides every file and cannot be changed
   at runtime; the module cannot detect it from the config alone.

HUD/logging control: connect to the abstract socket `\0<name>` per action, wait for the
handshake, send `:hud;` / `:logging=<0|1>;` / `:fcat;`, close. One client at a time in
MangoHud, so the module never holds the socket. Needs `control=<name>` in the user's config;
HELP.md says so. No state readback exists, so there is no "HUD visible" feedback.

Status lights (read-only):

- gamemode: `com.feralinteractive.GameMode` `ClientCount > 0`, plus the registered/unregistered
  signals. Replaces `gamemoded -s`.
- gamescope: find the `gamescope` process in `/proc`, read its flags from `cmdline`
  (`--hdr-enabled`, `--adaptive-sync`, `-W/-H/-r`), the game's `DISPLAY` and
  `ENABLE_GAMESCOPE_WSI` from a child's `environ`, then read `GAMESCOPE_*` atoms from that X
  display with the `x11` client. States: `on`, `off`, `req` (requested but not live), as in
  the old script.
- sensors: CPU temp (`k10temp`/`zenpower`), GPU temp (`amdgpu`) and `gpu_busy_percent` from
  sysfs, same logic as the old script.

Actions: set preset N, cycle preset, toggle HUD, logging start/stop/toggle, fcat toggle.

Feedbacks (boolean): preset is N, gamescope running, HDR on, HDR requested-not-live, VRR on,
VRR requested-not-live, WSI off (warning), gamemode active, control socket reachable.

Variables: `preset`, `preset_name`, `gs_running`, `gs_hdr`, `gs_vrr`, `gs_wsi`, `gs_mode`,
`gamemode`, `cpu_temp`, `gpu_temp`, `gpu_load`, `mangohud_version`.

### 6.3 Presets (both modules)

Layered presets (API 2.1+) rebuilding the existing MUSIC and GAMING pages: transport, shuffle
and loop with state, preset buttons, HDR/VRR/WSI/gamemode tiles, temps. Simple-preset
fallback through `type: 'alternatives'` where the layered form is not needed.

## 7. Repository layout

```
companion-modules/
  README.md
  modules/
    linux-media/        companion-module-linux-media
      companion/{manifest.json,HELP.md}
      src/{main,config,actions,feedbacks,variables,presets,upgrades}.ts
      src/mpris/{bus,player,tracker}.ts
      test/
      package.json  yarn.lock  tsconfig*.json  eslint.config.mjs
    mangohud/
      companion/{manifest.json,HELP.md}
      src/{main,config,actions,feedbacks,variables,presets,upgrades}.ts
      src/preset/{configFile,cycle}.ts
      src/control/socket.ts
      src/gamescope/{process,atoms}.ts
      src/sensors/{hwmon,gpu}.ts
      src/gamemode.ts
      test/
  docs/{plans,notes,decisions.md}
  .github/workflows/ci.yml
```

Each module is an independent yarn project (yarn 4, `nodeLinker: node-modules`, as in the
`companion-module-template-ts`). Point the Companion "Developer modules path" at
`modules/`: each subfolder is one module. Small files per concern, no single large `main.ts`.

## 8. Test strategy

The agent host has Node 26, `dbus-daemon`/`dbus-run-session`, and no Companion, MangoHud,
gamescope or GPU. So:

- Unit tests (`node --test`): preset file rewrite/parse (including per-app files, missing
  file, no `preset=` line), cycle logic, atom parsing, MPRIS state reducer, variable
  mapping.
- Integration tests under `dbus-run-session` with a fake MPRIS player and a fake gamemode
  service (the spikes in `docs/notes/spikes/` become the fixtures), run with the same
  `--permission --allow-net` flags Companion uses.
- Fake MangoHud abstract socket server that checks the exact bytes received.
- Temp-dir config tests for atomic replace and the `fs.watch` path.
- CI: lint, build, test on every PR; `yarn package` produces the `.tgz` artifact.

Cannot be verified by the agent (owner gates): real MangoHud reloading a changed preset,
real gamescope atoms and HDR/VRR states, `amdgpu`/`k10temp` sensor paths on the desktop,
loading the module in Companion and the button layouts.

## 9. Phases

**Phase 0: scaffold**

- Two module skeletons from `companion-module-template-ts`, CI, README.
- Exit: `yarn install && yarn build && yarn lint` passes in both; both load in a dev folder
  (owner gate) and show "Ok".

**Phase 1: media core**

- Estimate: 1 to 1.5 days.
- Exit: integration test passes with fake player (status, metadata, transport, volume, player
  appears/disappears); owner confirms real Spotify/mpv control.

**Phase 2: MangoHud presets and socket**

- Estimate: 1 day.
- Exit: unit + fake-socket tests pass; owner confirms preset switch and HUD toggle in a game.

**Phase 3: gamemode and sensors**

- Estimate: 0.5 day.
- Exit: fake gamemode service test passes; owner confirms temps and load on the desktop.

**Phase 4: gamescope status**

- Estimate: 1 day, riskiest. Verify first that `x11` can read root-window properties from
  gamescope's Xwayland display under the permission flags.
- Exit: parser tests pass against captured `xprop -root` output; owner confirms HDR/VRR/WSI
  tiles in a gamescope session.

**Phase 5: presets, HELP.md, migration guide**

- Estimate: 1 day.
- Exit: presets render in Companion; owner rebuilds one page from them.

Total estimate: 4.5 to 5 days of agent work. The calendar is gated by owner checks on the
desktop in phases 1 to 4.

## 10. Risks

- Per-game configs and `MANGOHUD_CONFIG` can make a preset switch look like a no-op
  (6.2). Mitigated by decision 5; the env-override case is documented only.
- `x11` client behaviour against gamescope's Xwayland is unproven (Phase 4 gate). Fallback:
  trust the `cmdline` flags only, as the old script does when no atom exists.
- `@particle/dbus-next` is a fork with a small maintainer base. It is pure JS and the
  surface used is small; the fallback is `@homebridge/dbus-native`.
- API drift: the plan targets API 2.2 (Companion 5.1+). Older Companion builds are not
  supported.

## 11. Appendix: old to new

- `/music/play-pause|next|previous|shuffle|loop|vol-up|vol-down` -> media actions.
- `/preset/<n>`, `/preset/cycle` -> mangohud set/cycle preset.
- `mp_status|player|artist|title|volume|shuffle|loop` -> media variables of the same meaning.
- `mh_preset`, `mh_preset_name`, `gs_*`, `gamemode`, `cpu_temp`, `gpu_temp`, `gpu_load` ->
  mangohud variables of the same name without the prefix noise.
- `$(custom:x)` in buttons becomes `$(<connection label>:x)`.
- `sys_*`, `mic_mute`: dropped (decision 2).

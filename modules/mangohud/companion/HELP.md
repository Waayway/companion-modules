## MangoHud

Switches MangoHud presets, toggles the HUD, logging and the fcat overlay, and reports gamemode,
CPU/GPU temperature, GPU load and gamescope status as read-only status. No helper program or HTTP
bridge is needed.

### Setup

Add a `control=<name>` line to `MangoHud.conf` (default name: `mangohud`) so MangoHud opens its
control socket. Without it, the toggle HUD / logging / fcat actions log a warning instead of
doing anything, and the "Control socket reachable" feedback stays false.

### Preset actions

"Set preset" and "Cycle preset" rewrite the `preset=` line in `MangoHud.conf` the same way the
in-game keybind does: the chosen preset is written first, followed by the rest of the configured
cycle order. MangoHud reloads the file automatically (it watches whichever config file it loaded).

Configure the cycle order and the label shown for each preset number in the per-app config
options. By default, "also update per-app configs" is on: the same `preset=` line is also written
to every other `*.conf` file in the config folder that already has one (per-game and per-wine-app
configs), so a preset switch does not silently do nothing for a game with its own config file.
`presets.conf` (MangoHud's own preset *definitions*) is never touched.

### Known limit

If a game's launch environment sets `MANGOHUD_CONFIG`, that overrides every config file for as
long as the game runs, and this module cannot detect or change that at runtime. Preset actions
will appear to do nothing until the game is restarted without that variable.

### No HUD-visible feedback

MangoHud's control protocol has no state readback: there is no way to ask it whether the HUD,
logging or fcat are currently on, so there is no feedback for those. "Preset is" reads the
preset number from the config file, and "Control socket reachable" only checks that something is
listening on the control socket.

### GameMode status

The `gamemode` variable and "GameMode active" feedback read `ClientCount` from gamemoded's
session D-Bus service (`com.feralinteractive.GameMode`), so they need `gamemoded` running (it
ships with Feral's GameMode and is normally started automatically when a game requests it) and a
reachable session bus. Companion does not forward `DBUS_SESSION_BUS_ADDRESS`, so the module
defaults to `unix:path=$XDG_RUNTIME_DIR/bus`; override it in the connection config if your session
bus lives elsewhere. If gamemoded is not running, `gamemode` simply reads "off" (not an error). If
the bus itself cannot be reached, that is logged once and retried in the background with
increasing backoff rather than repeated every poll.

### CPU/GPU sensors

`cpu_temp`, `gpu_temp` and `gpu_load` are read from sysfs on a timer (config field "Sensor poll
interval", default 2 s, minimum 500 ms): CPU temperature from the `k10temp` or `zenpower` hwmon
driver, GPU temperature from the `amdgpu` hwmon driver, and GPU load from
`gpu_busy_percent`. **These sensors assume an AMD CPU and an AMD GPU**: on anything else (Intel
GPU, Nvidia GPU, or a CPU without `k10temp`/`zenpower`), the corresponding variable simply reads
"-" and nothing is logged. The threshold feedbacks "CPU temperature above" and "GPU temperature
above" are false whenever the matching variable reads "-".

### Gamescope status

`gs_running`, `gs_hdr`, `gs_vrr`, `gs_wsi` and `gs_mode` are read from `/proc` and, when a game
is running under gamescope, from X11 root-window properties on gamescope's own Xwayland display
(config field "Gamescope status poll interval", default 2 s, minimum 500 ms). No `xprop` or other
child process is used: the pure-JS `x11` npm package talks the X11 protocol directly, and the
connection is made and closed per poll — nothing is held open.

- `gs_running`: `on`/`off` — whether a `gamescope`/`gamescope-wl` process owned by the same user
  is found at all. When it is not, every other gamescope variable reads `off`/`-` and none of the
  feedbacks below fire.
- `gs_hdr` and `gs_vrr`: `off`, `on` or `req`.
  - `off` means HDR/VRR was not requested on gamescope's command line (no `--hdr-enabled` /
    `--adaptive-sync`).
  - `on` means it was requested, and either gamescope confirms it is actually active (via the
    `GAMESCOPE_HDR_OUTPUT_FEEDBACK`/`GAMESCOPE_VRR_FEEDBACK` root-window atoms), or no such atom
    could be read yet — in which case the command-line flag is trusted.
  - `req` ("requested") means it was asked for on the command line, but gamescope's own feedback
    atom reports it is not actually live right now (for example, HDR was requested but the display
    does not support it, or VRR was requested but the compositor has not enabled it for this
    output). This is the one state worth watching for: the request did not take effect.
- `gs_wsi`: `on`/`off`, or `-` when no game process could be found yet to read it from.
  `ENABLE_GAMESCOPE_WSI=0` in the game's environment means `off`; unset or any other value means
  `on`. The "Gamescope WSI off" feedback is the practical "HDR is broken" warning: HDR cannot
  actually work while WSI is disabled, independently of what `gs_hdr` reports.
- `gs_mode`: `<width>x<height>[@<refresh>]` parsed from gamescope's `-W`/`--output-width`,
  `-H`/`--output-height` and `-r`/`--nested-refresh` command-line flags (long `--flag=value` form
  is also accepted). A missing width or height is shown as `?`; a missing refresh rate is simply
  omitted rather than shown as `@?`. Flags given after a bare `--` on the command line belong to
  the wrapped game, not gamescope, and are ignored.

Requirements: the `filesystem` runtime permission (already requested for the preset/sensor
features) for `/proc` access, and network access for the X11 connection (always allowed under
Companion's permission model, including to a Unix-socket X server). The X11 client reads
`~/.Xauthority` (or `XAUTHORITY`) itself; since Companion does not forward environment variables
like `XAUTHORITY` from your desktop session, the module temporarily sets it from the running
game's own environment (if the game process has one) only for the duration of each atoms read.

The gamescope process itself is found cheaply on every poll, but finding *which other process is
the game running inside it* (needed for its `DISPLAY`/`ENABLE_GAMESCOPE_WSI`/`XAUTHORITY`) means
scanning every process's environment, which is only done when that information is still unknown,
the gamescope process restarted, or the previous attempt to read the X11 atoms failed — not on
every poll.

### Presets

Three groups, reproducing the owner's old GAMING page buttons:

- **Gaming: HUD**: preset switch (Bar/Detail/Off, "selected" colour on the current preset; the
  numbers/labels match the config defaults, cycle `1,2,0` and `0=Off,1=Bar,2=Detail`), a cycle
  button showing the current preset's name, plus the small HUD/logging toggle extras (no
  feedback — MangoHud has no state readback for either, see "No HUD-visible feedback" above).
- **Gaming: status**: HDR/VRR tiles (green when on, red "FAIL" when requested but not live), WSI
  (red "OFF" when disabled — there is no "on" feedback to show otherwise), GameMode (green when
  active; no "requested" state exists for it), gamescope running, and the gamescope output mode
  text.
- **Gaming: sensors**: CPU temperature (orange above 80°C, red above 90°C) and GPU
  temperature+load (orange above 80°C, red above 95°C).

Each preset ships as `type: 'alternatives'`: a layered variant (no icon layer — the owner's icon
library isn't available to the module, so the label text and colour carry the meaning) with a
simple-style fallback for hosts that only render simple presets, such as Bitfocus Buttons.

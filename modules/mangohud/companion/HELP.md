## MangoHud

Switches MangoHud presets, toggles the HUD, logging and the fcat overlay, and reports gamemode,
CPU/GPU temperature and GPU load as read-only status. No helper program or HTTP bridge is needed.
Gamescope status is planned for a later version of this module (see docs/plans in the
repository).

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

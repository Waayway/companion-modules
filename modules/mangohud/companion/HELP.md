## MangoHud

Switches MangoHud presets and toggles the HUD, logging and the fcat overlay. No helper program
or HTTP bridge is needed. Gamescope, gamemode and sensor status are planned for a later version
of this module (see docs/plans in the repository).

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

# companion-modules

Native [Bitfocus Companion](https://bitfocus.io/companion) modules for a Linux desktop:

- `linux-media`: control any MPRIS media player over D-Bus.
- `mangohud`: MangoHud preset/HUD control plus gamescope, gamemode and sensor status.

They replace a Generic HTTP module + local helper script. No HTTP server, no child processes.

Status: `mangohud` has preset control, HUD/logging/fcat socket control, gamemode status and
CPU/GPU sensor status (plan phases 0-3); gamescope status (phase 4) and `linux-media` (phase 1)
are not started. See `docs/plans/`.

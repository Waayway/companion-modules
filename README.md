# companion-modules

Native [Bitfocus Companion](https://bitfocus.io/companion) modules for a Linux desktop:

- `linux-media`: control any MPRIS media player over D-Bus.
- `mangohud`: MangoHud preset/HUD control plus gamescope, gamemode and sensor status.

They replace a Generic HTTP module + local helper script. No HTTP server, no child processes.

Status: `mangohud` has preset control, HUD/logging/fcat socket control, gamemode status, CPU/GPU
sensor status and gamescope status (plan phases 0-4); `linux-media` (phase 1) is not started. See
`docs/plans/`.

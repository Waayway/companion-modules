# Spikes (throwaway, run on 2026-11-19)

Scripts that produced the "verified" claims in `../linux-integrations.md`. Not part of any module.

- MPRIS over pure-JS D-Bus, client run under Companion's permission flags:
  `npm i @particle/dbus-next && dbus-run-session -- bash run-mpris.sh`
- MangoHud-style abstract control socket, with and without the `filesystem` permission:
  `bash run-mangohud-socket.sh`

Result: the D-Bus client works with `--permission --allow-net` only. File reads, writes and
`fs.watch` are denied (`ERR_ACCESS_DENIED`) until `--allow-fs-read=* --allow-fs-write=*`.

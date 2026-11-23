# companion-modules

Native [Bitfocus Companion](https://bitfocus.io/companion) modules for a Linux desktop:

- `linux-media`: control any MPRIS media player over D-Bus.
- `mangohud`: MangoHud preset/HUD control plus gamescope, gamemode and sensor status.

They replace a Generic HTTP module + local helper script. No HTTP server, no child processes.

Status: plan phases 0 to 4 are done (both modules work against fakes and real D-Bus/X servers in tests).
Layered presets and the ready-made Companion config are still to do. See `docs/plans/`.

## Install with Nix

The flake builds both modules into one folder, `share/companion-modules/`, with a `linux-media/` and a
`mangohud/` folder in it. That folder is what Companion loads as a "developer modules path". This repo is
private, so use the SSH form of the input:

```nix
# flake.nix of your system
inputs.companion-modules = {
  url = "git+ssh://git@github.com/Waayway/companion-modules";
  inputs.nixpkgs.follows = "nixpkgs";
};
```

NixOS (links the modules to `/opt/companion-module-dev`, which headless Companion reads):

```nix
imports = [ inputs.companion-modules.nixosModules.default ];
programs.companion-modules.enable = true;
```

home-manager (links them to `~/.local/share/companion-modules`):

```nix
imports = [ inputs.companion-modules.homeManagerModules.default ];
programs.companion-modules.enable = true;
```

Then, for the desktop Companion app: launcher, Settings (cog), Developer modules path = that folder,
enable developer modules and restart. Add a connection of type `linux-media` and `mangohud`.

Without the modules: `nix build github:Waayway/companion-modules` (or `.#linux-media`,
`.#mangohud`) and point Companion at `result/share/companion-modules`.

Companion runs each module with only read access to its own real directory, so the folder must hold real
files, not symlinks into other store paths. The flake copies them for that reason.

## Develop

```
nix develop          # or direnv allow: node 26, yarn 4, dbus-run-session, Xvfb
cd modules/linux-media && yarn install && yarn test
```

Each module is its own yarn project (no hoisting, see `docs/plans/`). After changing a module's
dependencies (`yarn.lock`), refresh the Nix hashes: `nix/update-hashes.sh`.

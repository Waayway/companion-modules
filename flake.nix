{
  description = "Native Bitfocus Companion modules for a Linux desktop: MPRIS media + MangoHud/gamescope";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # Each module is its own yarn 4 project (no workspace, no hoisting): see docs/plans, section 4.
      # `yarn package` bundles the module with all of its dependencies into pkg/<id>; that folder is
      # exactly what Companion loads from a "developer modules path".
      mkModule =
        pkgs:
        {
          id,
          hash,
        }:
        let
          yarn = pkgs.yarn-berry_4;
          src = ./modules + "/${id}";
          missingHashes = src + "/.yarn-missing-hashes.json";
        in
        pkgs.stdenv.mkDerivation {
          pname = "companion-module-${id}";
          version = (builtins.fromJSON (builtins.readFile (src + "/package.json"))).version;
          inherit src missingHashes;

          nativeBuildInputs = [
            pkgs.nodejs_26
            yarn
            yarn.yarnBerryConfigHook
          ];

          offlineCache = yarn.fetchYarnBerryDeps {
            inherit src hash missingHashes;
          };

          buildPhase = ''
            runHook preBuild
            yarn package
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/companion-modules
            cp -r pkg/* $out/share/companion-modules/
            runHook postInstall
          '';

          meta = {
            description = "Bitfocus Companion module ${id}";
            license = pkgs.lib.licenses.mit;
            platforms = pkgs.lib.platforms.linux;
          };
        };

      moduleSpecs = {
        buttonbox.hash = "sha256-0kB9NKurVbn4eAW7XkD2LRIe05pyuMS9dnukZPhj2cM=";
        linux-media.hash = "sha256-v9fO45fUp5DYJoe80nDyODe6QNLbjViYCU09faBOos8=";
        mangohud.hash = "sha256-2i8DlgvYDZrU0ZqTKdafxJqYihggc8PwHpmt5RohEcY=";
      };

      modulePackages =
        pkgs:
        nixpkgs.lib.mapAttrs (
          id: spec:
          mkModule pkgs {
            inherit id;
            hash = spec.hash;
          }
        ) moduleSpecs;
    in
    {
      packages = forAllSystems (
        pkgs:
        let
          modules = modulePackages pkgs;
        in
        modules
        // {
          # Virtual joystick (uinput) daemon for the `buttonbox` module; run it next to Companion.
          buttonbox-daemon = pkgs.rustPlatform.buildRustPackage {
            pname = "companion-buttonbox";
            version = (builtins.fromTOML (builtins.readFile ./daemons/buttonbox/Cargo.toml)).package.version;
            src = ./daemons/buttonbox;
            cargoLock.lockFile = ./daemons/buttonbox/Cargo.lock;
            meta = {
              description = "Virtual joystick fed by Bitfocus Companion button presses";
              license = pkgs.lib.licenses.mit;
              platforms = pkgs.lib.platforms.linux;
              mainProgram = "companion-buttonbox";
            };
          };

          # One folder with every module: point Companion's "Developer modules path" at
          # <this package>/share/companion-modules.
          #
          # This is a COPY, not symlinkJoin: Companion only grants a module read access to its own real
          # directory, and files that are symlinks into another store path fail with ERR_ACCESS_DENIED.
          default = pkgs.runCommand "companion-modules" { } ''
            mkdir -p $out/share/companion-modules
            ${pkgs.lib.concatMapStringsSep "\n" (
              m: "cp -r ${m}/share/companion-modules/* $out/share/companion-modules/"
            ) (builtins.attrValues modules)}
          '';
        }
      );

      overlays.default = final: _prev: {
        companion-modules = self.packages.${final.stdenv.hostPlatform.system}.default;
      };

      nixosModules.default = import ./nix/nixos-module.nix self;
      homeManagerModules.default = import ./nix/home-manager-module.nix self;

      devShells = forAllSystems (
        pkgs:
        let
          # nixpkgs has yarn 4.14, but the lockfiles are written by 4.18 (the version in each
          # package.json "packageManager"); an older yarn refuses `install --immutable`.
          yarn = pkgs.stdenvNoCC.mkDerivation {
            pname = "yarn-berry";
            version = "4.18.1";
            src = pkgs.fetchurl {
              url = "https://registry.npmjs.org/@yarnpkg/cli-dist/-/cli-dist-4.18.1.tgz";
              hash = "sha256-9nKVk61MF3hOPUreU7PtaE49ujr1rbm+viG7hU/gsVM=";
            };
            nativeBuildInputs = [ pkgs.makeWrapper ];
            installPhase = ''
              mkdir -p $out/libexec $out/bin
              cp -r . $out/libexec/yarn
              makeWrapper ${pkgs.nodejs_26}/bin/node $out/bin/yarn --add-flags $out/libexec/yarn/bin/yarn.js
            '';
          };
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_26
              yarn
              pkgs.dbus # dbus-run-session for the integration tests
              pkgs.xorg-server # Xvfb for the gamescope X11 integration test
              pkgs.jq
              pkgs.cargo
              pkgs.rustc
              pkgs.rustfmt
              pkgs.clippy
            ];
          };
        }
      );
    };
}

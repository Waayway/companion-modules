{ self, nixpkgs }:
# Evaluation check for the NixOS and home-manager modules (no build): `nix eval --json .#checks...` is not
# used, run with: nix eval --impure --json --expr 'import ./nix/eval-test.nix { self = builtins.getFlake (toString ./.); nixpkgs = (builtins.getFlake (toString ./.)).inputs.nixpkgs; }'
let
  system = "x86_64-linux";
  sys = nixpkgs.lib.nixosSystem {
    inherit system;
    modules = [
      self.nixosModules.default
      {
        programs.companion-modules.enable = true;
        boot.loader.grub.enable = false;
        fileSystems."/" = {
          device = "none";
          fsType = "tmpfs";
        };
        system.stateVersion = "26.05";
      }
    ];
  };
  # Minimal stand-in for home-manager: just the options the module touches.
  hm = nixpkgs.lib.evalModules {
    modules = [
      self.homeManagerModules.default
      (
        { lib, ... }:
        {
          options.xdg.dataFile = lib.mkOption {
            type = lib.types.attrsOf lib.types.anything;
            default = { };
          };
          config._module.args.pkgs = nixpkgs.legacyPackages.${system};
          config.programs.companion-modules.enable = true;
        }
      )
    ];
  };
in
{
  tmpfiles = builtins.filter (r: nixpkgs.lib.hasInfix "companion-module" r) sys.config.systemd.tmpfiles.rules;
  homeDataFiles = builtins.attrNames hm.config.xdg.dataFile;
  homeSource = hm.config.xdg.dataFile."companion-modules".source;
}

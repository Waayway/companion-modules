self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.companion-modules;
in
{
  options.programs.companion-modules = {
    enable = lib.mkEnableOption "the linux-media and mangohud Bitfocus Companion modules";

    package = lib.mkOption {
      type = lib.types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "inputs.companion-modules.packages.\${system}.default";
      description = "Package holding the module folders under share/companion-modules.";
    };

    devModulesPath = lib.mkOption {
      type = lib.types.str;
      default = "/opt/companion-module-dev";
      description = ''
        Where the modules are linked. Headless Companion reads /opt/companion-module-dev; for the
        desktop app set "Developer modules path" in the launcher settings to this path.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];
    systemd.tmpfiles.rules = [
      "L+ ${cfg.devModulesPath} - - - - ${cfg.package}/share/companion-modules"
    ];
  };
}

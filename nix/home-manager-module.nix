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
  };

  config = lib.mkIf cfg.enable {
    # Point Companion's "Developer modules path" (launcher settings) at ~/.local/share/companion-modules.
    xdg.dataFile."companion-modules".source = "${cfg.package}/share/companion-modules";
  };
}

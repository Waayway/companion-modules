# Decisions

One line per owner answer, newest last.

- 2026-11-19: Replace the HTTP + Python bridge with native Companion modules, no HTTP.
- 2026-11-19: Two generic modules: media and MangoHud.
- 2026-11-19: Gamescope, gamemode and sensors go into the MangoHud module.
- 2026-11-19: No system volume / mic mute; the media module is MPRIS only.
- 2026-11-19: Repo is `Waayway/companion-modules`, created via `gh` as Waayway.
- Open (plan section 2, items 4 to 8): module ids, per-app config handling, preset labels,
  license, migration scope.
- 2026-11-19: Owner said "start". Open items 4 to 8 of the plan take the recommended answers:
  ids `linux-media` and `mangohud`; also update per-app MangoHud configs; preset cycle
  `1,2,0` with labels Off/Bar/Detail; MIT; presets only, no `.companionconfig` rewrite.

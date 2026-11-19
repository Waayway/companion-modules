# companion-module-linux-media

Control any MPRIS media player on Linux over D-Bus.

**Status**: MPRIS core, actions, feedbacks, presets and live reconnect are done (slices 1-2 of
the plan). Layered presets, real-device sign-off (Spotify/mpv) and the migration guide remain.

See `companion/HELP.md` for user docs and `../../docs/plans/` for the plan.

## Development

```
yarn install
yarn build
yarn lint
yarn test
yarn package   # builds an importable .tgz
```

Load it in Companion: Settings > Developer modules path = the `modules/` folder of this repo.

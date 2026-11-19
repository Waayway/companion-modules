# companion-module-linux-media

Control any MPRIS media player on Linux over D-Bus.

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

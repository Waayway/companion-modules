# companion-module-mangohud

MangoHud preset and HUD control, plus gamemode, CPU/GPU sensor and gamescope status (see
`docs/plans/` at the repository root).

See `companion/HELP.md` for user docs.

## Development

```
yarn install
yarn build
yarn lint
yarn test
yarn package   # builds an importable .tgz
```

Load it in Companion: Settings > Developer modules path = the `modules/` folder of this repo.

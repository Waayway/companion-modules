# Running headless Companion 5.1.3 for the smoke test

Status: [verified] - produced by `tools/smoke/run.sh` on this host (NixOS, no sudo), 2026-11-23.

## Build

```
nix build /var/lib/hermes/workspace/worktrees/companion-modules-smoke#default --no-link --print-out-paths
# -> /nix/store/<hash>-companion-modules
```

That path's `share/companion-modules/{linux-media,mangohud}` is real files (not symlinks, see
flake.nix) and is what Companion's "developer modules path" (`--extra-module-path`) must point at.

## Companion checkout

```
git clone --branch v5.1.3 --depth 1 https://github.com/bitfocus/companion.git \
  /var/lib/hermes/workspace/cm-smoke/companion
cd /var/lib/hermes/workspace/cm-smoke/companion
nix develop <this-repo> -c yarn install   # node 26.13.1, yarn 4.18.1 from the devShell
```

Node from the ambient environment was 26.12.1, which fails the workspace's own engines check
(`>=26.13.1 <27`) - always run through `nix develop <this-repo> -c ...`, never bare `node`/`yarn`.

No `yarn build`/`yarn dist` and no webui build are needed: see "How it boots" below.

## How it boots: reusing the e2e fixture, not `yarn dev`

`yarn dev` (`tools/dev.mts`) is for interactive development: it downloads Node runtimes, builds
the webui, builds esbuild thread bundles under `tsx watch`, and runs forever. Companion's own
Playwright e2e suite boots the real app a different, much leaner way worth copying:
`e2e/support/launch-app.mts` calls `createTestApp()` from `companion/test/integration/TestApp.ts`,
which constructs the real `Registry` directly (no CLI, no webui build - an empty `webui/build`
dir satisfies the static file server) and binds a real `http.Server`. Passing a non-null
`extraModulePath` makes it provision what spawning real module child processes needs: pinned
Node runtimes (`yarn fetch-runtimes`) and the esbuild-bundled thread entrypoints, the same
machinery `yarn dev` uses - so this is the real production module-spawning path, not a mock.

`tools/smoke/launch.mts` (in the companion checkout, added by this smoke test, not upstream) is a
small variant of `launch-app.mts`: it takes `configDir`/`extraModulePath` from
`COMPANION_SMOKE_CONFIG_DIR`/`COMPANION_SMOKE_MODULES_PATH` instead of hardcoded nulls, sets the
log level to `debug` (so the per-connection runtime command line - see below - is visible), and
prints the same `COMPANION_READY {"port":...,"configDir":...}` marker line on stdout once the
real `registry.ui.server` is listening. Run it as:

```
COMPANION_SMOKE_CONFIG_DIR=/path/to/config \
COMPANION_SMOKE_MODULES_PATH=/nix/store/<hash>-companion-modules/share/companion-modules \
nix develop <this-repo> -c \
  node --conditions=companion:source --import tsx tools/smoke/launch.mts
```

`registry.ready()` inside `createTestApp` binds `127.0.0.1` on a random port from `[20000, 32000)`
(never 8000, matches the brief's requirement) and retries with a fresh port if the first pick is
taken - see `TestApp.ts`'s `awaitListenOutcome`. `tools/smoke/lib/launchCompanion.mjs` spawns this
as a child process and resolves once it sees the ready marker, exactly like
`e2e/support/companion.ts` does for Playwright.

No inspector flag is ever passed, so permissions are on the whole time (the plan doc's own note -
"permissions are off while the inspector is attached" - does not apply here).

### NixOS-only environment fixup: the downloaded node runtimes don't run

`yarn fetch-runtimes` downloads generic prebuilt Node.js tarballs (`node18`/`node22`/`node26`) for
spawning module children. Every one of them is dynamically linked against
`/lib64/ld-linux-x86-64.so.2`, which does not exist on NixOS:

```
Could not start dynamically linked executable: /var/lib/hermes/workspace/cm-smoke/companion/.cache/node-runtime/linux-x64-26.13.1/bin/node
```

Both modules declare `"runtime": {"type": "node26"}`, and the devShell's own `node` happens to be
exactly 26.13.1 (same patch version Companion pins) - already a working, NixOS-native build.
`tools/smoke/launch.mts` symlinks the downloaded `node26` runtime's `bin/node` to
`fs.realpathSync(process.execPath)` right after `createTestApp()` returns (runtime guaranteed
present by then, no connection added yet). This is a one-line, version-exact-match-only fixup, not
a Companion bug - node18/22 are left broken since neither module needs them.

## Ports, config, env

- Config dir: whatever `COMPANION_SMOKE_CONFIG_DIR` points at (a plain directory, not `~/.config`).
  `tools/smoke/run.sh` uses a fresh `mktemp -d` scratch dir per run and deletes it on exit.
- Port: random, printed in the ready marker and in `UI/Server`'s own `new url: http://127.0.0.1:<port>/` log line. A real example from a run: `http://127.0.0.1:40223/`.
- `HOME`, `XDG_RUNTIME_DIR`, `TMPDIR`/`TMP`/`TEMP`, and `*_PROXY` are the only env vars Companion
  forwards to a module child (`companion/lib/Instance/Environment.ts` `PreserveEnvVars`) -
  `DBUS_SESSION_BUS_ADDRESS` is deliberately not in that list, matching both modules' HELP.md.
  `tools/smoke/e2e.mjs` sets `HOME` on the Companion process itself (so it reaches the mangohud
  child for its default `$HOME/.config/MangoHud` resolution) and passes the real
  `DBUS_SESSION_BUS_ADDRESS` through each connection's `busAddress` config field instead.

## REST and tRPC routes actually used

Companion has three parallel HTTP surfaces on the admin port; only the first two were needed:

- **Legacy/v1 REST, under `/api/`** (`companion/lib/Service/HttpApi.ts`, gated by the
  `http_api_enabled` user-config flag - `true` by default, no setup needed): `GET /api/connections`,
  `GET /api/connections/:id/status`, `GET /api/variable/:label/:name/value`,
  `POST /api/location/:page/:row/:column/press`. No auth.
- **Export/import, under `/int/`** (`companion/lib/UI/Express.ts`, `companion/lib/ImportExport/`):
  `GET /int/export/full?format=json`. This is a DNS-rebinding-guarded "internal" prefix (same-origin
  only; a loopback `Host` header, which a direct `http://127.0.0.1:<port>/...` request satisfies),
  **not** a sibling of the public `/api/` prefix - `GET /api/export/full` 404s. No auth either.
- **tRPC, over WebSocket only, at `/trpc`** (`companion/lib/UI/Handler.ts`,
  `webui/src/Resources/TRPC.tsx`): used for everything the REST APIs don't cover - creating
  connections (`instances.connections.add`/`setConfig`), building a button and wiring an
  action/feedback to a connection (`controls.resetControls`, `pages.watch`,
  `controls.entities.add`/`setOption`), and the whole import flow (`importExport.prepareImport.*`,
  `importExport.importFull`). The webui's own trpc client has `httpBatchLink` commented out and
  only ever uses `wsLink`, because `prepareImport.complete` stashes the parsed import object on the
  per-**connection** `ctx.pendingImport` (`companion/lib/UI/TRPC.ts`) - a fresh `ctx` per HTTP
  request would lose it immediately, so `tools/smoke/lib/trpcWs.mjs` and `import-config.mjs` also
  only ever use one persistent WS connection per session.
- **REST v2, under `/api/v2/`** (`companion/lib/Service/RestApi/`, bearer-token auth, gated by
  `rest_api_enabled` - `false` by default) exists in 5.1.3 but, as of this tag, only mounts
  connections and surfaces resource routers - no button-press or variable-read routes yet - so it
  was not useful here and the smoke test does not depend on it.

## The format finding

See `docs/notes/companion-connections-sample.json` (the two connections' exact `instances` entries
from a real export) and `docs/notes/companion-export-sample.json` (the full export they came from,
including a button whose action and feedback both reference `media`'s connection id). Produced
live by `tools/smoke/e2e.mjs`; both are safe to commit - neither module has a secret-typed config
field, so `secrets` is always `{}`.

- File format: `{"version": 12, "type": "full", ...}`, default-serialised as gzipped JSON
  (`companion/lib/ImportExport/Constants.ts` `FILE_VERSION`, `Util.ts` `prepareExport` -
  `format=json-gz` unless the export request explicitly asks for `format=json` or `format=yaml`).
- A connection's entry under `instances` (keyed by its opaque connection id): `moduleInstanceType`,
  `moduleId`, `moduleVersionId` (**the literal string `"dev"`** for a developer-modules-path
  module - see `companion/shared-lib/lib/Model/Instance.ts` and
  `companion/lib/Instance/ModuleInfo.ts`), `updatePolicy`, `sortOrder`, `label`, `isFirstInit`,
  `config`, `secrets`, `lastUpgradeIndex`, `enabled`.
- A button's action/feedback references the connection via a plain `connectionId` field sitting
  alongside `definitionId` (the action/feedback id, e.g. `playpause`), `options`, `upgradeIndex` and
  `type` (`"action"`/`"feedback"`) - see the `steps`/`feedbacks` excerpt in
  `companion-export-sample.json`.
- Importing headless: this is a **websocket-only, multi-step, stateful** tRPC flow, not a single
  REST call - `importExport.prepareImport.start` (name + byte size) -> N x
  `importExport.prepareImport.uploadChunk` (base64 chunks, sequential - the server holds exactly
  one upload session globally) -> `importExport.prepareImport.complete` (sha1 hex checksum of the
  whole file; returns a `[error, ClientImportObject]` **tuple**, not the object directly - see
  `companion/lib/ImportExport/Controller.ts` `#buildClientImportObject`) -> `importExport.importFull`
  (an explicit `ClientImportOrResetSelection`, e.g. `buttons: 'reset-and-import'`,
  `connections: 'reset'`; runs as a deferred task, poll `importExport.importExportTaskStatus` for
  `status: 'completed'`). `tools/smoke/import-config.mjs <file.companionconfig> [companionUrl]`
  implements exactly this and was verified by importing this smoke test's own export back into a
  second, freshly-booted instance (see the smoke report).
- One behaviour worth knowing before handing over a converted config: both connections came back
  with status `{"category":null,"level":null,"message":"Disabled"}` right after import, even
  though the export had `"enabled": true` for both - a full import with `connections: 'reset'`
  does not re-enable connections automatically. Call `instances.connections.setEnabled` (or use the
  webui) afterwards.

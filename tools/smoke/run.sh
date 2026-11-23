#!/usr/bin/env bash
# Starts a real headless Companion with the linux-media and mangohud dev modules loaded, runs the
# e2e checks in tools/smoke/e2e.mjs, tears everything down, and exits non-zero on failure.
#
# Requires: a Nix install (for the devShell: node 26, yarn 4, dbus-run-session), and a clone of
# bitfocus/companion (tag v5.1.3) at $COMPANION_SMOKE_REPO (default: /var/lib/hermes/workspace/
# cm-smoke/companion) with `yarn install` already run - see docs/notes/companion-headless.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export COMPANION_SMOKE_REPO="${COMPANION_SMOKE_REPO:-/var/lib/hermes/workspace/cm-smoke/companion}"

if [ ! -d "$COMPANION_SMOKE_REPO/companion" ]; then
	echo "No companion checkout at $COMPANION_SMOKE_REPO - see docs/notes/companion-headless.md" >&2
	exit 2
fi

SCRATCH_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cm-smoke-e2e.XXXXXX")"
cleanup() {
	rm -rf "$SCRATCH_ROOT"
}
trap cleanup EXIT

echo "building modules (nix build .#default)..."
MODULES_OUT="$(nix build "$REPO_ROOT#default" --no-link --print-out-paths)"
export COMPANION_SMOKE_MODULES_PATH="$MODULES_OUT/share/companion-modules"

export COMPANION_SMOKE_CONFIG_DIR="$SCRATCH_ROOT/config"
export COMPANION_SMOKE_HOME="$SCRATCH_ROOT/home"
export COMPANION_SMOKE_RESULTS_FILE="$SCRATCH_ROOT/results.json"
mkdir -p "$COMPANION_SMOKE_CONFIG_DIR" "$COMPANION_SMOKE_HOME"

echo "modules path: $COMPANION_SMOKE_MODULES_PATH"
echo "config dir:   $COMPANION_SMOKE_CONFIG_DIR"
echo "scratch home: $COMPANION_SMOKE_HOME"

cd "$REPO_ROOT"
nix develop "$REPO_ROOT" -c dbus-run-session -- node tools/smoke/e2e.mjs

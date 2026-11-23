#!/usr/bin/env bash
# Imports a converted .companionconfig into a real headless Companion and presses its buttons.
# Usage: tools/smoke/verify-config.sh <file.companionconfig>
# Needs what run.sh needs (nix, a Companion v5.1.3 checkout, see docs/notes/companion-headless.md).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export COMPANION_SMOKE_REPO="${COMPANION_SMOKE_REPO:-/var/lib/hermes/workspace/cm-smoke/companion}"
CONFIG="$(readlink -f "${1:?usage: verify-config.sh <file.companionconfig>}")"

SCRATCH_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cm-verify-config.XXXXXX")"
trap 'rm -rf "$SCRATCH_ROOT"' EXIT

MODULES_OUT="$(nix build "$REPO_ROOT#default" --no-link --print-out-paths)"
export COMPANION_SMOKE_MODULES_PATH="$MODULES_OUT/share/companion-modules"
export COMPANION_SMOKE_CONFIG_DIR="$SCRATCH_ROOT/config"
export COMPANION_SMOKE_HOME="$SCRATCH_ROOT/home"
mkdir -p "$COMPANION_SMOKE_CONFIG_DIR" "$COMPANION_SMOKE_HOME"

cd "$REPO_ROOT"
nix develop "$REPO_ROOT" -c dbus-run-session -- node tools/smoke/verify-config.mjs "$CONFIG"

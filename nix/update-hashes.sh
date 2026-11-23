#!/usr/bin/env bash
# Refresh the Nix dependency hashes after changing a module's dependencies (yarn.lock).
# Rewrites modules/<id>/.yarn-missing-hashes.json and the offline-cache hash in flake.nix.
# Run from anywhere inside the repo; needs nix with flakes and network access.
set -euo pipefail
cd "$(dirname "$0")/.."

FAKE="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

for dir in modules/*/; do
  id="$(basename "$dir")"
  echo "== $id"
  nix run nixpkgs#yarn-berry_4.yarn-berry-fetcher -- missing-hashes "modules/$id/yarn.lock" \
    >"modules/$id/.yarn-missing-hashes.json"
  git add -N "modules/$id/.yarn-missing-hashes.json"

  old="$(sed -n "s/^ *$id\.hash = \"\(.*\)\";/\1/p" flake.nix)"
  [ -n "$old" ] || { echo "no hash entry for $id in flake.nix" >&2; exit 1; }
  sed -i "s#$id.hash = \"$old\"#$id.hash = \"$FAKE\"#" flake.nix

  log="$(nix build ".#$id" --no-link 2>&1 || true)"
  new="$(printf '%s\n' "$log" | sed -n 's/^ *got: *\(sha256-[^ ]*\)$/\1/p' | sed -n 1p)"
  if [ -z "$new" ]; then
    # The fake hash built, or failed for another reason: restore and let the real build report.
    sed -i "s#$id.hash = \"$FAKE\"#$id.hash = \"$old\"#" flake.nix
    echo "hash unchanged for $id"
  else
    sed -i "s#$id.hash = \"$FAKE\"#$id.hash = \"$new\"#" flake.nix
    echo "$id.hash = $new"
  fi
done

echo "verify:"
nix build .#default --no-link
echo "ok"

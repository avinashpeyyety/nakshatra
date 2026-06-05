#!/usr/bin/env bash
# Build macOS dmg locally, wait for CI Windows exe (or use existing), publish release.
# Usage: ./scripts/fetch_and_publish_release.sh 1.0.0 [workflow_run_id]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Usage: fetch_and_publish_release.sh VERSION [run_id]}"
RUN_ID="${2:-}"

export GH_TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | awk -F= '/^password=/{print $2}')"
export GH_HOST=github.com

echo "==> Building macOS dmg"
"$ROOT/scripts/package_desktop.sh" "$VERSION"

EXE="$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe"
if [[ ! -f "$EXE" ]]; then
  if [[ -z "$RUN_ID" ]]; then
    echo "==> Triggering build-windows-exe workflow"
    gh workflow run build-windows-exe.yml --repo avinashpeyyety/nakshatra -f "version=${VERSION}"
    echo "Waiting for workflow run..."
    sleep 10
    RUN_ID="$(gh run list --repo avinashpeyyety/nakshatra --workflow=build-windows-exe.yml --limit 1 --json databaseId -q '.[0].databaseId')"
  fi
  echo "==> Watching run $RUN_ID"
  gh run watch "$RUN_ID" --repo avinashpeyyety/nakshatra --exit-status
  TMP="$(mktemp -d)"
  gh run download "$RUN_ID" --repo avinashpeyyety/nakshatra -D "$TMP"
  find "$TMP" -name "*-windows.exe" -exec cp {} "$EXE" \;
  [[ -f "$EXE" ]] || { echo "Failed to find windows exe in artifacts"; exit 1; }
fi

"$ROOT/scripts/publish_github_release.sh" "$VERSION"
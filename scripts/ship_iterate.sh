#!/usr/bin/env bash
# Ship loop after every nakshatra iterate: push main + rebuild installers + Pages.
#
# Usage:
#   ./scripts/ship_iterate.sh              # auto patch bump from docs/site.json
#   ./scripts/ship_iterate.sh 1.0.5        # explicit version
#   ./scripts/ship_iterate.sh 1.0.5 --push-only   # git push only (no package)
#   ./scripts/ship_iterate.sh 1.0.5 --mac-only    # mac dmg + publish with existing win exe if present
#
# Requires: git credentials for github.com; gh CLI or GH_TOKEN for Windows CI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUSH_ONLY=0
MAC_ONLY=0
VERSION=""
for arg in "$@"; do
  case "$arg" in
    --push-only) PUSH_ONLY=1 ;;
    --mac-only) MAC_ONLY=1 ;;
    -*)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
    *)
      VERSION="$arg"
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  CUR="$(python3 -c "import json; print(json.load(open('docs/site.json')).get('version','1.0.0'))" 2>/dev/null || echo "1.0.0")"
  # patch bump: 1.0.4 -> 1.0.5
  VERSION="$(python3 -c "
v='${CUR}'.strip().lstrip('v')
parts=[int(x) for x in v.split('.')]
while len(parts)<3: parts.append(0)
parts[2]+=1
print('.'.join(str(p) for p in parts[:3]))
")"
  echo "==> Auto version ${CUR} → ${VERSION}"
fi

# GitHub token for gh (workflow + download artifacts)
if [[ -z "${GH_TOKEN:-}" ]]; then
  GH_TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | awk -F= '/^password=/{print $2}')" || true
  export GH_TOKEN
fi
export GH_HOST=github.com

echo "==> Ensuring clean-enough tree (committed work only)"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: uncommitted changes — commit first, then re-run ship_iterate.sh" >&2
  git status -sb
  exit 1
fi

echo "==> Push origin/main"
git push -u origin HEAD:main

if [[ "$PUSH_ONLY" -eq 1 ]]; then
  echo "==> --push-only: done (no installer rebuild)"
  exit 0
fi

echo "==> Build macOS dmg v${VERSION}"
chmod +x scripts/package_desktop.sh scripts/publish_github_release.sh scripts/fetch_and_publish_release.sh
./scripts/package_desktop.sh "$VERSION"

EXE="$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe"
if [[ ! -f "$EXE" && "$MAC_ONLY" -eq 0 ]]; then
  if command -v gh >/dev/null 2>&1 && [[ -n "${GH_TOKEN:-}" ]]; then
    echo "==> Trigger Windows exe CI (build-windows-exe)"
    # Prefer authenticated gh; fall back to token env
    if ! gh auth status &>/dev/null; then
      export GH_TOKEN
    fi
    gh workflow run build-windows-exe.yml --repo avinashpeyyety/nakshatra -f "version=${VERSION}"
    sleep 12
    RUN_ID="$(gh run list --repo avinashpeyyety/nakshatra --workflow=build-windows-exe.yml --limit 1 --json databaseId -q '.[0].databaseId')"
    echo "==> Watching Windows run $RUN_ID"
    gh run watch "$RUN_ID" --repo avinashpeyyety/nakshatra --exit-status
    TMP="$(mktemp -d)"
    gh run download "$RUN_ID" --repo avinashpeyyety/nakshatra -D "$TMP"
    find "$TMP" -name "*-windows.exe" -exec cp {} "$EXE" \;
    rm -rf "$TMP"
  else
    echo "WARN: no gh/token — cannot build Windows exe via CI" >&2
  fi
fi

if [[ ! -f "$EXE" ]]; then
  echo "ERROR: missing $EXE" >&2
  echo "  Build Windows via: gh workflow run build-windows-exe.yml -f version=${VERSION}" >&2
  echo "  Or re-run: ./scripts/fetch_and_publish_release.sh ${VERSION}" >&2
  echo "  macOS dmg is ready: dist/nakshatra-chakram-${VERSION}-macos.dmg" >&2
  exit 1
fi

echo "==> Publish installers to GitHub Pages"
./scripts/publish_github_release.sh "$VERSION"

# Keep local working tree site.json in sync with what was published
python3 - <<PY
import json
from pathlib import Path
p = Path("docs/site.json")
site = {
  "appName": "Nakshatra Chakram",
  "tagline": "Local Vedic birth chart and nakshatra wheel — your data stays on your computer.",
  "version": "${VERSION}",
  "downloadMac": f"https://avinashpeyyety.github.io/nakshatra/downloads/nakshatra-chakram-${VERSION}-macos.dmg",
  "downloadWindows": f"https://avinashpeyyety.github.io/nakshatra/downloads/nakshatra-chakram-${VERSION}-windows.exe",
  "releasesUrl": "https://avinashpeyyety.github.io/nakshatra/#downloads",
  "donateUrl": "https://ko-fi.com/avinashpeyyety",
  "issuesUrl": "https://github.com/avinashpeyyety/nakshatra/issues",
  "siteUrl": "https://avinashpeyyety.github.io/nakshatra/",
}
p.write_text(json.dumps(site, indent=2) + "\n", encoding="utf-8")
print("Updated local docs/site.json →", site["version"])
PY

if ! git diff --quiet -- docs/site.json; then
  git add docs/site.json
  git commit -m "docs: site.json v${VERSION} after ship"
  git push origin HEAD:main
fi

echo ""
echo "Shipped v${VERSION}"
echo "  macOS:   https://avinashpeyyety.github.io/nakshatra/downloads/nakshatra-chakram-${VERSION}-macos.dmg"
echo "  Windows: https://avinashpeyyety.github.io/nakshatra/downloads/nakshatra-chakram-${VERSION}-windows.exe"
echo "  Site:    https://avinashpeyyety.github.io/nakshatra/"

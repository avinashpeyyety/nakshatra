#!/usr/bin/env bash
# Ship loop after every nakshatra iterate: push main + rebuild installers + Pages.
#
# Usage:
#   ./scripts/ship_iterate.sh              # auto patch bump from docs/site.json
#   ./scripts/ship_iterate.sh 1.1.0        # explicit version
#   ./scripts/ship_iterate.sh 1.1.0 --push-only
#   ./scripts/ship_iterate.sh 1.1.0 --mac-only
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
  VERSION="$(python3 -c "
v='${CUR}'.strip().lstrip('v')
parts=[int(x) for x in v.split('.')]
while len(parts)<3: parts.append(0)
parts[2]+=1
print('.'.join(str(p) for p in parts[:3]))
")"
  echo "==> Auto version ${CUR} → ${VERSION}"
fi

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
  echo "==> --push-only: done"
  exit 0
fi

echo "==> Build macOS dmg (lite + advisor) v${VERSION}"
chmod +x scripts/package_desktop.sh scripts/publish_github_release.sh
./scripts/package_desktop.sh "$VERSION" lite
./scripts/package_desktop.sh "$VERSION" advisor

build_win() {
  local edition="$1"
  local out="$ROOT/dist/nakshatra-chakram-${VERSION}-${edition}-windows.exe"
  if [[ -f "$out" ]]; then
    echo "==> Windows ${edition} exe already present"
    return 0
  fi
  if [[ "$MAC_ONLY" -eq 1 ]]; then
    return 1
  fi
  if ! command -v gh >/dev/null 2>&1 || [[ -z "${GH_TOKEN:-}" ]]; then
    echo "WARN: no gh/token for Windows ${edition}" >&2
    return 1
  fi
  echo "==> Trigger Windows exe CI (edition=${edition})"
  gh workflow run build-windows-exe.yml --repo avinashpeyyety/nakshatra \
    -f "version=${VERSION}" -f "edition=${edition}"
  sleep 12
  RUN_ID="$(gh run list --repo avinashpeyyety/nakshatra --workflow=build-windows-exe.yml --limit 1 --json databaseId -q '.[0].databaseId')"
  echo "==> Watching Windows run $RUN_ID (${edition})"
  gh run watch "$RUN_ID" --repo avinashpeyyety/nakshatra --exit-status
  TMP="$(mktemp -d)"
  gh run download "$RUN_ID" --repo avinashpeyyety/nakshatra -D "$TMP"
  find "$TMP" -name "*-windows.exe" -exec cp {} "$out" \;
  rm -rf "$TMP"
  [[ -f "$out" ]]
}

build_win lite || true
build_win advisor || true

EXE_LITE="$ROOT/dist/nakshatra-chakram-${VERSION}-lite-windows.exe"
EXE_ADV="$ROOT/dist/nakshatra-chakram-${VERSION}-advisor-windows.exe"
# Compat: single unprefixed exe counts as lite only if lite missing
if [[ ! -f "$EXE_LITE" && -f "$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe" ]]; then
  cp "$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe" "$EXE_LITE"
fi

for f in \
  "$ROOT/dist/nakshatra-chakram-${VERSION}-lite-macos.dmg" \
  "$ROOT/dist/nakshatra-chakram-${VERSION}-advisor-macos.dmg" \
  "$EXE_LITE" \
  "$EXE_ADV"
do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

echo "==> Publish installers to GitHub Pages"
./scripts/publish_github_release.sh "$VERSION"

python3 - <<PY
import json
from pathlib import Path
V = "${VERSION}"
SITE = "https://avinashpeyyety.github.io/nakshatra"
site = {
  "appName": "Nakshatra Chakram",
  "tagline": "Local Vedic birth chart and nakshatra wheel — your data stays on your computer.",
  "version": V,
  "downloadMacLite": f"{SITE}/downloads/nakshatra-chakram-{V}-lite-macos.dmg",
  "downloadWindowsLite": f"{SITE}/downloads/nakshatra-chakram-{V}-lite-windows.exe",
  "downloadMacAdvisor": f"{SITE}/downloads/nakshatra-chakram-{V}-advisor-macos.dmg",
  "downloadWindowsAdvisor": f"{SITE}/downloads/nakshatra-chakram-{V}-advisor-windows.exe",
  "downloadMac": f"{SITE}/downloads/nakshatra-chakram-{V}-lite-macos.dmg",
  "downloadWindows": f"{SITE}/downloads/nakshatra-chakram-{V}-lite-windows.exe",
  "releasesUrl": f"{SITE}/#downloads",
  "donateUrl": "https://ko-fi.com/avinashpeyyety",
  "issuesUrl": "https://github.com/avinashpeyyety/nakshatra/issues",
  "siteUrl": f"{SITE}/",
}
Path("docs/site.json").write_text(json.dumps(site, indent=2) + "\n", encoding="utf-8")
print("Updated local docs/site.json →", V)
PY

if ! git diff --quiet -- docs/site.json; then
  git add docs/site.json
  git commit -m "docs: site.json v${VERSION} lite+advisor after ship"
  git push origin HEAD:main
fi

echo ""
echo "Shipped v${VERSION} (lite + advisor)"
echo "  Site: https://avinashpeyyety.github.io/nakshatra/"

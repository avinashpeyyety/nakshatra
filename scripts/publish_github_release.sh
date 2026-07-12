#!/usr/bin/env bash
# Publish Lite + Advisor installers (macOS .dmg + Windows .exe) to GitHub Pages.
# Usage: ./scripts/publish_github_release.sh 1.1.0
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Usage: publish_github_release.sh VERSION}"
TAG="v${VERSION}"
REPO="avinashpeyyety/nakshatra"
SITE_BASE="https://avinashpeyyety.github.io/nakshatra"

need() {
  local f="$1"
  [[ -f "$f" ]] || { echo "Missing $f" >&2; exit 1; }
}

DMG_LITE="$ROOT/dist/nakshatra-chakram-${VERSION}-lite-macos.dmg"
DMG_ADV="$ROOT/dist/nakshatra-chakram-${VERSION}-advisor-macos.dmg"
EXE_LITE="$ROOT/dist/nakshatra-chakram-${VERSION}-lite-windows.exe"
EXE_ADV="$ROOT/dist/nakshatra-chakram-${VERSION}-advisor-windows.exe"

# Fallback: unprefixed names treated as lite
if [[ ! -f "$DMG_LITE" && -f "$ROOT/dist/nakshatra-chakram-${VERSION}-macos.dmg" ]]; then
  DMG_LITE="$ROOT/dist/nakshatra-chakram-${VERSION}-macos.dmg"
fi
if [[ ! -f "$EXE_LITE" && -f "$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe" ]]; then
  EXE_LITE="$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe"
fi

need "$DMG_LITE"
need "$DMG_ADV"
need "$EXE_LITE"
need "$EXE_ADV"

if [[ -z "${GH_TOKEN:-}" ]]; then
  GH_TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | awk -F= '/^password=/{print $2}')"
  export GH_TOKEN
fi
export GH_HOST=github.com

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Cloning $REPO"
git clone --depth 1 "https://github.com/$REPO.git" "$WORKDIR/repo"
cd "$WORKDIR/repo"

if git lfs version &>/dev/null; then
  git lfs install --local
  git lfs track "docs/downloads/*.exe" "docs/downloads/*.dmg"
else
  echo "WARN: git-lfs not installed; pushing large binaries without LFS"
fi

mkdir -p docs/downloads
rm -f docs/downloads/nakshatra-chakram-*-macos.dmg docs/downloads/nakshatra-chakram-*-windows.exe
cp "$DMG_LITE" "docs/downloads/nakshatra-chakram-${VERSION}-lite-macos.dmg"
cp "$DMG_ADV" "docs/downloads/nakshatra-chakram-${VERSION}-advisor-macos.dmg"
cp "$EXE_LITE" "docs/downloads/nakshatra-chakram-${VERSION}-lite-windows.exe"
cp "$EXE_ADV" "docs/downloads/nakshatra-chakram-${VERSION}-advisor-windows.exe"
# Back-compat links: plain names → lite
cp "$DMG_LITE" "docs/downloads/nakshatra-chakram-${VERSION}-macos.dmg"
cp "$EXE_LITE" "docs/downloads/nakshatra-chakram-${VERSION}-windows.exe"

cp "$ROOT/docs/index.html" docs/index.html
cp "$ROOT/docs/about.html" docs/about.html 2>/dev/null || true
cp "$ROOT/docs/FEATURES.md" docs/FEATURES.md
[[ -f "$ROOT/docs/ADVISOR.md" ]] && cp "$ROOT/docs/ADVISOR.md" docs/ADVISOR.md
if [[ -f "$ROOT/public-releases/README.md" ]]; then
  cp "$ROOT/public-releases/README.md" README.md
elif [[ -f "$ROOT/README.md" ]]; then
  cp "$ROOT/README.md" README.md
fi

cat > docs/site.json <<EOF
{
  "appName": "Nakshatra Chakram",
  "tagline": "Local Vedic birth chart and nakshatra wheel — your data stays on your computer.",
  "version": "${VERSION}",
  "downloadMacLite": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-lite-macos.dmg",
  "downloadWindowsLite": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-lite-windows.exe",
  "downloadMacAdvisor": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-advisor-macos.dmg",
  "downloadWindowsAdvisor": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-advisor-windows.exe",
  "downloadMac": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-lite-macos.dmg",
  "downloadWindows": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-lite-windows.exe",
  "releasesUrl": "${SITE_BASE}/#downloads",
  "donateUrl": "https://ko-fi.com/avinashpeyyety",
  "issuesUrl": "https://github.com/avinashpeyyety/nakshatra/issues",
  "siteUrl": "${SITE_BASE}/"
}
EOF

git add -A
git commit -m "downloads: v${VERSION} lite + advisor (macOS/Windows, Pages)"

echo "==> Pushing to $REPO (Pages deploy follows automatically)"
git push origin main

echo "==> Removing any GitHub Releases (we publish via Pages only)"
for old_tag in v1.0.0 v1.0.1 v1.0.2 v1.0.3 v1.0.4 v1.0.5 "$TAG"; do
  gh release view "$old_tag" --repo "$REPO" &>/dev/null && \
    gh release delete "$old_tag" --repo "$REPO" --yes --cleanup-tag || true
done

echo "==> Downloads:"
echo "    Lite macOS:    ${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-lite-macos.dmg"
echo "    Lite Windows:  ${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-lite-windows.exe"
echo "    Advisor macOS: ${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-advisor-macos.dmg"
echo "    Advisor Win:   ${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-advisor-windows.exe"
echo "    Site:          ${SITE_BASE}/"

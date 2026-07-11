#!/usr/bin/env bash
# Publish macOS .dmg + Windows .exe to nakshatra (GitHub Pages).
# Avoids GitHub Releases "Source code (zip)" artifacts, which cannot be removed on public repos.
# Usage: ./scripts/publish_github_release.sh 1.0.0
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?Usage: publish_github_release.sh VERSION}"
TAG="v${VERSION}"
REPO="avinashpeyyety/nakshatra"
SITE_BASE="https://avinashpeyyety.github.io/nakshatra"
DMG="$ROOT/dist/nakshatra-chakram-${VERSION}-macos.dmg"
EXE="$ROOT/dist/nakshatra-chakram-${VERSION}-windows.exe"

[[ -f "$DMG" ]] || { echo "Missing $DMG — run ./scripts/package_desktop.sh $VERSION"; exit 1; }
[[ -f "$EXE" ]] || { echo "Missing $EXE — build via CI or ./scripts/fetch_and_publish_release.sh"; exit 1; }

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
  echo "WARN: git-lfs not installed; pushing large .exe without LFS (brew install git-lfs recommended)"
fi

mkdir -p docs/downloads
# Replace prior version binaries (single current release on Pages).
rm -f docs/downloads/nakshatra-chakram-*-macos.dmg docs/downloads/nakshatra-chakram-*-windows.exe
cp "$DMG" "docs/downloads/nakshatra-chakram-${VERSION}-macos.dmg"
cp "$EXE" "docs/downloads/nakshatra-chakram-${VERSION}-windows.exe"
cp "$ROOT/docs/index.html" docs/index.html
cp "$ROOT/docs/about.html" docs/about.html
cp "$ROOT/docs/FEATURES.md" docs/FEATURES.md
# Prefer slim public-releases README when present; else keep repo README.
if [[ -f "$ROOT/public-releases/README.md" ]]; then
  cp "$ROOT/public-releases/README.md" README.md
elif [[ -f "$ROOT/README.md" ]]; then
  cp "$ROOT/README.md" README.md
fi
cp "$ROOT/docs/site.json" docs/site.json
# site.json overwritten below with publish URLs for this version

cat > docs/site.json <<EOF
{
  "appName": "Nakshatra Chakram",
  "tagline": "Local Vedic birth chart and nakshatra wheel — your data stays on your computer.",
  "version": "${VERSION}",
  "downloadMac": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-macos.dmg",
  "downloadWindows": "${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-windows.exe",
  "releasesUrl": "${SITE_BASE}/#downloads",
  "donateUrl": "https://ko-fi.com/avinashpeyyety",
  "issuesUrl": "https://github.com/avinashpeyyety/nakshatra/issues",
  "siteUrl": "${SITE_BASE}/"
}
EOF

git add -A
git commit -m "downloads: v${VERSION} macOS dmg + Windows exe (Pages only, no Release zips)"

echo "==> Pushing to $REPO (Pages deploy follows automatically)"
git push origin main

echo "==> Removing any GitHub Releases (we publish via Pages only)"
for old_tag in v1.0.0 v1.0.1 v1.0.2 v1.0.3 "$TAG"; do
  gh release view "$old_tag" --repo "$REPO" &>/dev/null && \
    gh release delete "$old_tag" --repo "$REPO" --yes --cleanup-tag || true
done

echo "==> Downloads (no source-code zips):"
echo "    macOS:   ${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-macos.dmg"
echo "    Windows: ${SITE_BASE}/downloads/nakshatra-chakram-${VERSION}-windows.exe"
echo "    Site:    ${SITE_BASE}/"
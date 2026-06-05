#!/usr/bin/env bash
# Build desktop release artifacts (nakshatra repo).
# Usage: ./scripts/package_desktop.sh [VERSION]
#
# macOS: Nakshatra Chakram.app + .dmg (standard install; ad-hoc signed)
# Windows: zip with run-windows.bat (build on Windows)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  if git -C "$ROOT" describe --tags --abbrev=0 &>/dev/null; then
    VERSION="$(git -C "$ROOT" describe --tags --abbrev=0 | sed 's/^v//')"
  else
    VERSION="0.0.0-dev"
  fi
fi

APP_NAME="Nakshatra Chakram"
BUNDLE_ID="com.avinashpeyyety.nakshatra-chakram"
DIST="$ROOT/dist"
STAGE="$DIST/stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "==> Packaging ${APP_NAME} v$VERSION"

# ── Shared application payload (not shown at zip root on macOS) ─────────────
APP_PAYLOAD="$STAGE/app-payload"
mkdir -p "$APP_PAYLOAD"
rsync -a \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'data/jobs.db' \
  --exclude 'data/*.db' \
  --exclude 'data/watch_profile.json' \
  --exclude 'data/email_settings.json' \
  --exclude 'data/geocode_cache.json' \
  --exclude 'data/_build' \
  "$ROOT/agent/" "$APP_PAYLOAD/agent/"
cp "$ROOT/requirements.txt" "$APP_PAYLOAD/"
cp "$ROOT/.env.example" "$APP_PAYLOAD/"

write_mac_launcher() {
  local out="$1"
  cat > "$out" << 'LAUNCH'
#!/bin/bash
set -euo pipefail
export NAKSHATRA_ADMIN=0

APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUPPORT_DIR="${HOME}/Library/Application Support/Nakshatra Chakram"
VENV_DIR="${SUPPORT_DIR}/venv"
LOG_FILE="${SUPPORT_DIR}/launcher.log"
PORT=8765
URL="http://127.0.0.1:${PORT}"

mkdir -p "$SUPPORT_DIR"
exec >>"$LOG_FILE" 2>&1
echo "=== Launch $(date) ==="

cd "$APP_ROOT"

# macOS ships Python 3.9 (Xcode) — too old. Need 3.10+ from python.org or Homebrew.
PY=""
_py_ok() {
  local bin="$1"
  [[ -n "$bin" && -x "$bin" ]] || return 1
  "$bin" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null
}
for candidate in \
  python3.13 python3.12 python3.11 python3.10 \
  /opt/homebrew/bin/python3.13 /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3.10 /opt/homebrew/bin/python3 \
  /usr/local/bin/python3.13 /usr/local/bin/python3.12 /usr/local/bin/python3.11 /usr/local/bin/python3.10 /usr/local/bin/python3 \
  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 \
  /Library/Frameworks/Python.framework/Versions/3.12/bin/python3 \
  /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 \
  /Library/Frameworks/Python.framework/Versions/3.10/bin/python3; do
  if _py_ok "$candidate"; then
    PY="$candidate"
    echo "Using Python: $PY ($("$PY" -c 'import sys; print(sys.version.split()[0])'))"
    break
  fi
done

if [[ -z "$PY" ]]; then
  osascript -e 'display alert "Python 3.10+ required" message "macOS includes Python 3.9, which is too old. Install Python 3.11 or 3.12 from https://www.python.org/downloads/ (macOS 64-bit universal2 installer), then open Nakshatra Chakram again."' 2>/dev/null \
    || echo "Install Python 3.10+ from https://www.python.org/downloads/"
  exit 1
fi

venv_ok() {
  [[ -x "${VENV_DIR}/bin/python" ]] \
    && "${VENV_DIR}/bin/python" -c 'import sys; assert sys.version_info >= (3, 10); import agent.server' 2>/dev/null
}

if ! venv_ok; then
  osascript -e 'display notification "First launch: installing dependencies (a few minutes)…" with title "Nakshatra Chakram"' 2>/dev/null || true
  rm -rf "$VENV_DIR"
  "$PY" -m venv "$VENV_DIR"
  "${VENV_DIR}/bin/pip" install -q -r requirements.txt
fi

# Shipped app uses 8765 — never attach to a dev server on :8000.
if lsof -i :${PORT} -sTCP:LISTEN -t &>/dev/null; then
  open "$URL" 2>/dev/null || true
  exit 0
fi

"${VENV_DIR}/bin/python" -m agent.server --host 127.0.0.1 --port "${PORT}" &
PID=$!

for _ in $(seq 1 90); do
  if curl -sf "${URL}/api/app-config" >/dev/null 2>&1; then
    open "$URL" 2>/dev/null || true
    wait "$PID"
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    osascript -e 'display alert "Nakshatra Chakram failed to start" message "See launcher.log in Application Support/Nakshatra Chakram."' 2>/dev/null || true
    exit 1
  fi
  sleep 2
done

osascript -e 'display alert "Nakshatra Chakram is still starting" message "Wait a minute and open http://127.0.0.1:8765 in your browser."' 2>/dev/null || true
open "$URL" 2>/dev/null || true
wait "$PID"
LAUNCH
  chmod +x "$out"
}

OS="$(uname -s)"
case "$OS" in
  Darwin)
    APP_DIR="$STAGE/${APP_NAME}.app"
    RES="$APP_DIR/Contents/Resources"
    MACOS="$APP_DIR/Contents/MacOS"
    mkdir -p "$MACOS" "$RES"

    cp -R "$APP_PAYLOAD/" "$RES/app/"

    write_mac_launcher "$MACOS/${APP_NAME}"

    cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
  <key>CFBundleName</key><string>${APP_NAME}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

    # Ad-hoc sign — does not replace Apple notarization, but avoids some local "damaged" errors
    if command -v codesign &>/dev/null; then
      codesign --force --deep -s - "$APP_DIR" 2>/dev/null || true
    fi

    # DMG layout (drag app to Applications)
    DMG_STAGE="$STAGE/dmg-root"
    rm -rf "$DMG_STAGE"
    mkdir -p "$DMG_STAGE"
    cp -R "$APP_DIR" "$DMG_STAGE/"
    ln -s /Applications "$DMG_STAGE/Applications"
    cat > "$DMG_STAGE/Install Nakshatra Chakram.txt" << README
Nakshatra Chakram v${VERSION}
============================

1. Drag "Nakshatra Chakram.app" to the Applications folder.
2. Open it from Applications (not from the DMG).

First launch needs Python 3.10+ on your Mac and will install dependencies once.

If macOS says the app cannot be opened:
  • Right-click the app → Open → Open again, OR
  • System Settings → Privacy & Security → Open Anyway

Requires network on first run only (pip install). Charts stay local after that.

Uninstall: delete Nakshatra Chakram.app from Applications.
README

    DMG_OUT="$DIST/nakshatra-chakram-${VERSION}-macos.dmg"
    rm -f "$DMG_OUT"
    hdiutil create \
      -volname "Nakshatra Chakram ${VERSION}" \
      -srcfolder "$DMG_STAGE" \
      -ov \
      -format UDZO \
      "$DMG_OUT" >/dev/null
    echo "==> Created $DMG_OUT"
    ;;

  MINGW*|MSYS*|CYGWIN*)
    WIN_STAGE="$STAGE/nakshatra-chakram-${VERSION}"
    cp -R "$APP_PAYLOAD/" "$WIN_STAGE/"
    cat > "$WIN_STAGE/run-windows.bat" << 'RUNWIN'
@echo off
cd /d "%~dp0"
set NAKSHATRA_ADMIN=0
where python >nul 2>&1 || (
  echo Python 3 is required. Install from https://www.python.org/downloads/
  pause
  exit /b 1
)
if not exist .venv (
  echo Creating virtual environment...
  python -m venv .venv
  call .venv\Scripts\pip install -q -r requirements.txt
)
start http://127.0.0.1:8000
.venv\Scripts\python -m agent.server --host 127.0.0.1 --port 8000
RUNWIN
    ZIP_OUT="$DIST/nakshatra-chakram-${VERSION}-windows.zip"
    (cd "$STAGE" && zip -rq "$ZIP_OUT" "nakshatra-chakram-${VERSION}")
    echo "==> Created $ZIP_OUT"
    ;;

  *)
    ZIP_OUT="$DIST/nakshatra-chakram-${VERSION}.zip"
    FALLBACK="$STAGE/nakshatra-chakram-${VERSION}"
    cp -R "$APP_PAYLOAD/" "$FALLBACK/"
    (cd "$STAGE" && zip -rq "$ZIP_OUT" "nakshatra-chakram-${VERSION}")
    echo "==> Created $ZIP_OUT (build on macOS for .dmg)"
    ;;
esac

echo ""
echo "Next: ./scripts/publish_github_release.sh $VERSION"
echo "Note: Without Apple Developer notarization, users may need Right-click → Open on first launch."
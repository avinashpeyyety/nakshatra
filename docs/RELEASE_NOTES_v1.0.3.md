# Nakshatra Chakram v1.0.3

## Download

[Landing page](https://avinashpeyyety.github.io/nakshatra/#downloads) — `nakshatra-chakram-1.0.3-macos.dmg` and `nakshatra-chakram-1.0.3-windows.exe`.

## Fixes in v1.0.3

- **Connection refused on :8765** — Python environment now installs under `~/Library/Application Support/Nakshatra Chakram/venv` (not inside the read-only `.app`), using native Apple Silicon Python when applicable.
- Waits for the server to respond before opening the browser (first launch can take a few minutes).
- Errors are logged to `~/Library/Application Support/Nakshatra Chakram/launcher.log`.

## Install (macOS)

1. Replace the app in **Applications** with the new build (delete the old one first).
2. Optional clean reset: `rm -rf ~/Library/Application\ Support/Nakshatra\ Chakram/venv`
3. Open from Applications → **http://127.0.0.1:8765**

## Support

https://github.com/avinashpeyyety/nakshatra/issues
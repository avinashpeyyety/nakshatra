# Nakshatra Chakram v1.0.4

## Download

[Landing page](https://avinashpeyyety.github.io/nakshatra/#downloads)

## Fix: app failed to start on Mac

- Requires **Python 3.10+** from [python.org](https://www.python.org/downloads/) or Homebrew (`brew install python@3.12`).
- macOS built-in **Python 3.9** (Xcode) is **not** supported — caused `TypeError: unsupported operand type(s) for |`.
- Launcher now searches for `python3.12`, `python3.11`, Homebrew, and python.org installs.

## macOS setup

1. Install **Python 3.12** from python.org (universal2 macOS installer).
2. Delete old app from Applications; install new `.dmg`.
3. First launch: wait several minutes for dependencies.
4. App URL: **http://127.0.0.1:8765**

## Support

https://github.com/avinashpeyyety/nakshatra/issues
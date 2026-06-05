# Public release — single repo, GitHub Pages, no signups

How **Nakshatra Chakram** ships from one public repository:

| Layer | Location |
|-------|----------|
| **Source + dev** | [github.com/avinashpeyyety/nakshatra](https://github.com/avinashpeyyety/nakshatra) |
| **Landing page** | [avinashpeyyety.github.io/nakshatra](https://avinashpeyyety.github.io/nakshatra/) (`docs/`) |
| **Installers** | `docs/downloads/` + GitHub Releases tags |
| **User charts** | Local SQLite on the user's machine — never uploaded |

*Former split (`nakshatra` installers-only + private `nakshatra-chakram`) merged into this repo.*

---

## Live URLs

| Resource | URL |
|----------|-----|
| Landing page | https://avinashpeyyety.github.io/nakshatra/ |
| Latest downloads | https://avinashpeyyety.github.io/nakshatra/#downloads |
| Issues | https://github.com/avinashpeyyety/nakshatra/issues |

---

## Release checklist

1. Merge `develop` → `main` (or release branch).
2. Tag `vX.Y.Z` on `main`.
3. Build artifacts:
   ```bash
   ./scripts/fetch_and_publish_release.sh X.Y.Z
   ```
   Or use `.github/workflows/release-desktop.yml` (macOS + Windows CI).
4. Confirm `docs/downloads/` and `docs/site.json` point at the new version.
5. Push `main` — Pages workflow redeploys when `docs/` changes.

Installer filenames stay `nakshatra-chakram-<version>-macos.dmg` / `-windows.exe` (product name unchanged).

---

## Privacy model

- No accounts, trials, or license servers.
- `.env` and `credentials/` are gitignored — never commit API keys.
- Public builds omit the Jobs & Agents admin tab (`NAKSHATRA_ADMIN=0`).

See also [SHIP_STRATEGY.md](SHIP_STRATEGY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
"""Desktop entry point for PyInstaller builds (Windows .exe)."""
from __future__ import annotations

import os
import sys
import threading
import time
import webbrowser


def _bundle_root() -> str:
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read_edition(root: str) -> str:
    for rel in ("agent/edition.txt", "edition.txt"):
        path = os.path.join(root, rel)
        if os.path.isfile(path):
            try:
                with open(path, encoding="utf-8") as f:
                    val = f.read().strip().lower()
                if val in ("lite", "advisor"):
                    return val
            except OSError:
                pass
    return "lite"


def main() -> None:
    root = _bundle_root()
    os.chdir(root)
    os.environ.setdefault("NAKSHATRA_ADMIN", "0")
    os.environ.setdefault("NAKSHATRA_EDITION", _read_edition(root))

    if root not in sys.path:
        sys.path.insert(0, root)

    from agent.data_paths import default_server_port

    port = default_server_port()
    url = f"http://127.0.0.1:{port}"

    def _open_browser() -> None:
        time.sleep(2.5)
        webbrowser.open(url)

    threading.Thread(target=_open_browser, daemon=True).start()

    import uvicorn
    from agent.server import app

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
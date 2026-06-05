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


def main() -> None:
    root = _bundle_root()
    os.chdir(root)
    os.environ.setdefault("NAKSHATRA_ADMIN", "0")

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
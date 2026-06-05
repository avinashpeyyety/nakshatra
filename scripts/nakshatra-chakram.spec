# PyInstaller spec — build on Windows: pyinstaller scripts/nakshatra-chakram.spec
import sys
from pathlib import Path

ROOT = Path(SPECPATH).parent

a = Analysis(
    [str(ROOT / "scripts" / "desktop_entry.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        (str(ROOT / "agent" / "static"), "agent/static"),
        (str(ROOT / "agent" / "data" / "places.json"), "agent/data"),
    ],
    hiddenimports=[
        "agent",
        "agent.server",
        "agent.calculator",
        "agent.chart_store",
        "agent.geocode",
        "agent.transit_filter",
        "agent.app_config",
        "agent.env",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "fastapi",
        "starlette",
        "starlette.routing",
        "pydantic",
        "pydantic_core",
        "swisseph",
        "timezonefinder",
        "timezonefinder.internal",
        "pytz",
        "multipart",
        "anyio",
        "httptools",
        "watchfiles",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest", "tkinter"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="nakshatra-chakram",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
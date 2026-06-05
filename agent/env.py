"""Load environment variables from this project and workspace sibling .env files."""
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

_PROJECT = Path(__file__).resolve().parent.parent
_WORKSPACE = _PROJECT.parent

# Sibling projects in the workspace (e.g. lang-chain-system/.env with XAI_API_KEY)
_WORKSPACE_ENV_FILES = (
    "lang-chain-system/.env",
    "data_forensics/.env",
)


def bootstrap_env() -> None:
    for rel in _WORKSPACE_ENV_FILES:
        path = _WORKSPACE / rel
        if path.is_file():
            load_dotenv(path, override=False)
    local = _PROJECT / ".env"
    if local.is_file():
        load_dotenv(local, override=True)


bootstrap_env()

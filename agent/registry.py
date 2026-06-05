"""
Module registry — auto-discovers all automation modules in agent/modules/.

A module is any .py file in that directory that exports:
  TOOL_DEFINITIONS : list[dict]   — Anthropic-style tool schemas
  dispatch(tool_name, args) -> dict  — executes a named tool

Adding a new automation agent is as simple as dropping a new file in
agent/modules/ that follows this contract. No other files need to change.
"""

import importlib
import pkgutil
from pathlib import Path
from typing import Any

_MODULES_PKG = "agent.modules"
_MODULES_DIR = Path(__file__).parent / "modules"


class ModuleInfo:
    def __init__(self, name: str, tool_definitions: list[dict], dispatch_fn):
        self.name = name
        self.tool_definitions = tool_definitions
        self._dispatch = dispatch_fn
        self.tool_names: set[str] = {t["name"] for t in tool_definitions}

    def dispatch(self, tool_name: str, tool_input: dict) -> dict[str, Any]:
        return self._dispatch(tool_name, tool_input)


class Registry:
    def __init__(self):
        self._modules: dict[str, ModuleInfo] = {}
        self._tool_to_module: dict[str, ModuleInfo] = {}

    def load(self) -> None:
        """Discover and load all modules from agent/modules/."""
        for finder, module_name, _ in pkgutil.iter_modules([str(_MODULES_DIR)]):
            if module_name.startswith("_"):
                continue
            full_name = f"{_MODULES_PKG}.{module_name}"
            try:
                mod = importlib.import_module(full_name)
            except Exception as exc:
                print(f"[registry] failed to load module '{module_name}': {exc}")
                continue

            tool_defs = getattr(mod, "TOOL_DEFINITIONS", None)
            dispatch_fn = getattr(mod, "dispatch", None)

            if not tool_defs or not dispatch_fn:
                print(f"[registry] skipping '{module_name}': missing TOOL_DEFINITIONS or dispatch()")
                continue

            info = ModuleInfo(module_name, tool_defs, dispatch_fn)
            self._modules[module_name] = info
            for tool_name in info.tool_names:
                self._tool_to_module[tool_name] = info

            print(f"[registry] loaded module '{module_name}' with {len(tool_defs)} tool(s)")

    @property
    def all_tool_definitions(self) -> list[dict]:
        defs = []
        for mod in self._modules.values():
            defs.extend(mod.tool_definitions)
        return defs

    @property
    def module_list(self) -> list[dict]:
        """Serialisable summary of loaded modules for the UI."""
        return [
            {
                "name": mod.name,
                "tools": [
                    {"name": t["name"], "description": t["description"]}
                    for t in mod.tool_definitions
                ],
            }
            for mod in self._modules.values()
        ]

    def dispatch(self, tool_name: str, tool_input: dict) -> dict[str, Any]:
        mod = self._tool_to_module.get(tool_name)
        if not mod:
            raise ValueError(
                f"No module registered for tool '{tool_name}'. "
                f"Known tools: {sorted(self._tool_to_module)}"
            )
        return mod.dispatch(tool_name, tool_input)


# Singleton — imported everywhere
registry = Registry()

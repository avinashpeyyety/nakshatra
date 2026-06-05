"""
ADMIN ONLY — MCP bridge for automation modules. See ARCHITECTURE.md.

Exposes registered automation modules as MCP tools for the Cursor SDK launcher.

Run directly for testing:
    python -m agent.mcp_server
"""

import asyncio
import json
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import CallToolResult, ListToolsResult, TextContent, Tool

from agent.registry import registry

registry.load()

app = Server("automation-hub")


def _to_mcp_tool(definition: dict) -> Tool:
    return Tool(
        name=definition["name"],
        description=definition["description"],
        inputSchema=definition["input_schema"],
    )


@app.list_tools()
async def list_tools() -> ListToolsResult:
    return ListToolsResult(tools=[_to_mcp_tool(d) for d in registry.all_tool_definitions])


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> CallToolResult:
    try:
        result = registry.dispatch(name, arguments)
        return CallToolResult(
            content=[TextContent(type="text", text=json.dumps(result, indent=2))]
        )
    except Exception as exc:
        return CallToolResult(
            content=[TextContent(type="text", text=json.dumps({"error": str(exc)}))],
            isError=True,
        )


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())

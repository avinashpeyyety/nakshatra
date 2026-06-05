"""
ADMIN ONLY — general automation agent (Gmail, Calendar, Office). See ARCHITECTURE.md.

Headless Anthropic tool-use agent loop.
"""

import json
import os

import anthropic
from dotenv import load_dotenv

from agent.registry import registry

load_dotenv()

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-5")
MAX_TOKENS = int(os.environ.get("ANTHROPIC_MAX_TOKENS", "4096"))

SYSTEM_PROMPT = """\
You are a powerful automation assistant. You have access to a growing set of
automation modules — currently email and calendar, with more coming.

Guidelines:
- Be concise and action-oriented.
- Always confirm what you did at the end of your final response.
- When uncertain about dates, times, or recipients, ask before acting.
- Never send emails or create calendar events without explicit instruction.
"""


def run(task: str, *, max_turns: int = 20, verbose: bool = True) -> str:
    """
    Execute a task using the Anthropic tool-use loop.

    Returns the final text reply from the model.
    """
    registry.load()

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    messages: list[dict] = [{"role": "user", "content": task}]
    final_text = ""

    for turn in range(max_turns):
        if verbose:
            print(f"\n[turn {turn + 1}] Calling model…", flush=True)

        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=registry.all_tool_definitions,
            messages=messages,
        )

        for block in response.content:
            if block.type == "text" and block.text:
                final_text = block.text
                if verbose:
                    print(f"[assistant] {block.text}", flush=True)

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []

            for block in response.content:
                if block.type == "tool_use":
                    if verbose:
                        print(f"[tool_use] {block.name}({json.dumps(block.input, indent=2)})", flush=True)
                    try:
                        result = registry.dispatch(block.name, block.input)
                        if verbose:
                            print(f"[tool_result] {json.dumps(result, indent=2)}", flush=True)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        })
                    except Exception as exc:
                        error = {"error": str(exc)}
                        if verbose:
                            print(f"[tool_error] {error}", flush=True)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(error),
                            "is_error": True,
                        })

            messages.append({"role": "user", "content": tool_results})
        else:
            if verbose:
                print(f"[warn] Unexpected stop_reason: {response.stop_reason}", flush=True)
            break

    return final_text

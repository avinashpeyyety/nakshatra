"""
Interactive REPL for the headless email/calendar agent.

Reads tasks from stdin in a loop — no need to re-run the script between tasks.
Conversation context is reset between tasks (each task is independent).

Usage:
    python -m agent.interactive
    python -m agent.interactive --quiet
"""

import argparse
import sys

from agent.core import run
from agent.registry import registry

BANNER = """
╔══════════════════════════════════════════════╗
║        Automation Hub Agent  (Claude)        ║
║   Type a task and press Enter to run it.     ║
║   Commands:  /quit  /exit  /help  /modules   ║
╚══════════════════════════════════════════════╝
"""

HELP = """
Available commands:
  /quit, /exit   Exit the agent
  /help          Show this message
  /clear         Clear the terminal screen

Anything else is treated as a task for the agent, e.g.:
  > List my calendar events for this week
  > Send an email to alice@example.com with subject "Hello"
  > What unread emails do I have from my boss?
"""


def _clear_screen() -> None:
    import os
    os.system("cls" if os.name == "nt" else "clear")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Interactive REPL for the headless email/calendar agent."
    )
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress per-step tool output; print only the final reply.",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=20,
        metavar="N",
        help="Maximum agentic loop turns per task (default: 20).",
    )
    args = parser.parse_args()

    print(BANNER)

    while True:
        try:
            task = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            sys.exit(0)

        if not task:
            continue

        if task.lower() in ("/quit", "/exit"):
            print("Goodbye.")
            sys.exit(0)

        if task.lower() == "/help":
            print(HELP)
            continue

        if task.lower() == "/clear":
            _clear_screen()
            continue

        if task.lower() == "/modules":
            registry.load()
            for mod in registry.module_list:
                tools = ", ".join(t["name"] for t in mod["tools"])
                print(f"  [{mod['name']}]  {tools}")
            continue

        if task.startswith("/"):
            print(f"Unknown command: {task}  (type /help for available commands)")
            continue

        print()
        try:
            result = run(task, max_turns=args.max_turns, verbose=not args.quiet)
            if args.quiet:
                print(result)
        except KeyboardInterrupt:
            print("\n[interrupted]")
        except Exception as exc:
            print(f"[error] {exc}")


if __name__ == "__main__":
    main()

"""
Standalone CLI entry point.

Usage:
    python -m agent.cli "Send an email to alice@example.com with subject Hello"
    python -m agent.cli --quiet "List my events this week"
"""

import argparse
import sys

from agent.core import run


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Headless email/calendar agent powered by Anthropic Claude."
    )
    parser.add_argument("task", help="Natural-language task for the agent.")
    parser.add_argument(
        "--quiet",
        "-q",
        action="store_true",
        help="Suppress per-step output; print only the final reply.",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=20,
        metavar="N",
        help="Maximum agentic loop turns (default: 20).",
    )
    args = parser.parse_args()

    result = run(args.task, max_turns=args.max_turns, verbose=not args.quiet)

    if args.quiet:
        print(result)


if __name__ == "__main__":
    main()

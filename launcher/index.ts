/**
 * Cursor SDK launcher — orchestrates the headless email/calendar agent
 * using @cursor/february with the Python MCP server attached.
 *
 * Usage:
 *   CURSOR_API_KEY=... npx tsx launcher/index.ts "Book a call with John tomorrow at 3pm"
 *
 * The agent runs locally in the current working directory (project root).
 * It has access to the Python MCP server, which exposes Gmail and Google
 * Calendar tools.
 */

import path from "node:path";
import { Agent } from "@cursor/february/agent";

const task = process.argv.slice(2).join(" ").trim();

if (!task) {
  console.error("Usage: npx tsx launcher/index.ts <task>");
  console.error('  e.g. npx tsx launcher/index.ts "List my events this week"');
  process.exit(1);
}

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  console.error("CURSOR_API_KEY environment variable is required.");
  process.exit(1);
}

// Project root is one level up from the launcher/ directory
const projectRoot = path.resolve(__dirname, "..");

async function main(): Promise<void> {
  const agent = Agent.create({
    apiKey,
    model: { id: "composer-2" },
    local: {
      cwd: projectRoot,
      settingSources: ["project"],
    },
    mcpServers: {
      emailCalendar: {
        type: "stdio",
        command: "python",
        args: ["-m", "agent.mcp_server"],
        cwd: projectRoot,
      },
    },
  });

  console.log(`[launcher] agent id: ${agent.agentId}`);
  console.log(`[launcher] task: ${task}\n`);

  try {
    const run = await agent.send(task);

    console.log(`[launcher] run id: ${run.id}`);
    console.log("[launcher] streaming…\n");

    for await (const event of run.stream()) {
      switch (event.type) {
        case "assistant":
          for (const block of event.message.content) {
            if (block.type === "text") {
              process.stdout.write(block.text);
            }
          }
          break;

        case "thinking":
          // Omit extended thinking from stdout by default
          break;

        case "tool_call":
          if (event.status === "running") {
            console.log(`\n[tool] ${event.name} → running…`);
          } else if (event.status === "completed") {
            console.log(`[tool] ${event.name} → done`);
          }
          break;

        case "status":
          if (event.status !== "RUNNING") {
            console.log(`\n[status] ${event.status}`);
          }
          break;

        case "task":
          console.log(`[task] ${event.text}`);
          break;
      }
    }

    const result = await run.wait();
    console.log(`\n[launcher] finished — status: ${result.status}`);
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

main().catch((err) => {
  console.error("[launcher] fatal error:", err);
  process.exit(1);
});

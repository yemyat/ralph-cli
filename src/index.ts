#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";
import { logsCommand } from "./commands/logs.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { stopCommand } from "./commands/stop.js";
import type { AgentType } from "./types.js";

const program = new Command();

program
  .name("ralph-wiggum-cli")
  .description("CLI for managing Ralph Wiggum AI development workflows")
  .version("1.0.2");

program
  .command("init")
  .description("Initialize Ralph in the current project")
  .option("-a, --agent <agent>", "AI agent for both modes (claude, amp, droid)")
  .option("-m, --model <model>", "Model for both modes")
  .option("--plan-agent <agent>", "AI agent for planning mode")
  .option("--plan-model <model>", "Model for planning mode")
  .option("--build-agent <agent>", "AI agent for building mode")
  .option("--build-model <model>", "Model for building mode")
  .option("-f, --force", "Force reinitialization")
  .action(async (options) => {
    await initCommand({
      agent: options.agent as AgentType,
      model: options.model,
      planAgent: options.planAgent as AgentType,
      planModel: options.planModel,
      buildAgent: options.buildAgent as AgentType,
      buildModel: options.buildModel,
      force: options.force,
    });
  });

program
  .command("start [mode]")
  .description("Start the Ralph loop (plan or build)")
  .option("-a, --agent <agent>", "Override agent (claude, amp, droid)")
  .option("-m, --model <model>", "Override model")
  .option("-n, --max-iterations <n>", "Maximum iterations", Number.parseInt)
  .option("-v, --verbose", "Verbose output")
  .action(async (mode, options) => {
    const validModes = ["plan", "build"];
    if (!validModes.includes(mode)) {
      console.log(chalk.red(`Invalid mode: ${mode}. Use 'plan' or 'build'.`));
      return;
    }
    await startCommand(mode as "plan" | "build", {
      agent: options.agent as AgentType,
      model: options.model,
      maxIterations: options.maxIterations,
      verbose: options.verbose,
    });
  });

program
  .command("stop")
  .description("Stop the running Ralph session")
  .action(async () => {
    await stopCommand();
  });

program
  .command("status")
  .description("Show status of the current project's Ralph")
  .action(async () => {
    await statusCommand();
  });

program
  .command("list")
  .alias("ls")
  .description("List all Ralph projects and their sessions")
  .action(async () => {
    await listCommand();
  });

program
  .command("logs")
  .description("View logs for a session")
  .option("-s, --session-id <id>", "Session ID (defaults to latest)")
  .option("-n, --lines <n>", "Number of lines to show", Number.parseInt, 50)
  .option("-f, --follow", "Follow log output")
  .action(async (options) => {
    await logsCommand({
      sessionId: options.sessionId,
      lines: options.lines,
      follow: options.follow,
    });
  });

program
  .command("agents")
  .description("List available AI agents")
  .action(async () => {
    const { getAllAgents } = await import("./agents/index.js");
    console.log(chalk.bold("\n🤖 Available Agents\n"));
    for (const agent of getAllAgents()) {
      const installed = await agent.checkInstalled();
      const status = installed
        ? chalk.green("✓ installed")
        : chalk.red("✗ not installed");
      console.log(
        `  ${chalk.cyan(agent.type.padEnd(8))} ${agent.name.padEnd(15)} ${status}`
      );
    }
    console.log();
  });

program.parse();

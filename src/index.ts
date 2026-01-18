#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { buildCommand } from "./commands/build";
import { initCommand } from "./commands/init";
import { planCommand } from "./commands/plan";
import { statusCommand } from "./commands/status";
import { stopCommand } from "./commands/stop";
import type { AgentType } from "./types";

const program = new Command();

program
  .name("ralph-wiggum-cli")
  .description("CLI for managing Ralph Wiggum AI development workflows")
  .version("1.0.6");

program
  .command("init")
  .description("Initialize Ralph in the current project")
  .option("-a, --agent <agent>", "AI agent for both modes")
  .option("-m, --model <model>", "Model for both modes")
  .option("--plan-agent <agent>", "AI agent for planning")
  .option("--plan-model <model>", "Model for planning")
  .option("--build-agent <agent>", "AI agent for building")
  .option("--build-model <model>", "Model for building")
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
  .command("plan")
  .description(
    "Run planning mode - analyze specs and create implementation plan"
  )
  .option("-a, --agent <agent>", "Override agent")
  .option("-m, --model <model>", "Override model")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    await planCommand({
      agent: options.agent as AgentType,
      model: options.model,
      verbose: options.verbose,
    });
  });

program
  .command("build")
  .description("Run build mode - execute tasks from implementation plan")
  .option("-a, --agent <agent>", "Override agent")
  .option("-m, --model <model>", "Override model")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    await buildCommand({
      agent: options.agent as AgentType,
      model: options.model,
      verbose: options.verbose,
    });
  });

program
  .command("status")
  .description("Show project status and sessions")
  .action(statusCommand);

program.command("stop").description("Stop running session").action(stopCommand);

program
  .command("agents")
  .description("List available AI agents")
  .action(async () => {
    const { getAllAgents } = await import("./agents/index");
    console.log(pc.bold("\n🤖 Available Agents\n"));
    for (const agent of getAllAgents()) {
      const installed = await agent.checkInstalled();
      const status = installed ? pc.green("✓") : pc.red("✗");
      console.log(
        `  ${status} ${pc.cyan(agent.type.padEnd(10))} ${agent.name}`
      );
    }
    console.log();
  });

program.parse();

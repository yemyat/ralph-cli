import chalk from "chalk";
import { getAgent } from "../agents/index.js";
import { getProjectConfig, getProjectSessions } from "../config.js";
import type { RalphSession } from "../types.js";

function getStatusColor(status: RalphSession["status"]): typeof chalk.green {
  switch (status) {
    case "running":
      return chalk.green;
    case "paused":
      return chalk.yellow;
    case "completed":
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

export async function statusCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(chalk.red("Ralph is not initialized for this project."));
    console.log(`Run ${chalk.cyan("ralph-wiggum-cli init")} first.`);
    return;
  }

  const agent = getAgent(config.agent);

  console.log(chalk.bold("\n📋 Project Status\n"));
  console.log(`  Project:    ${chalk.cyan(config.projectName)}`);
  console.log(`  Agent:      ${chalk.cyan(agent.name)}`);
  console.log(`  Model:      ${chalk.cyan(config.model || "default")}`);
  console.log(`  Created:    ${chalk.gray(config.createdAt)}`);

  const sessions = await getProjectSessions(projectPath);

  if (sessions.length === 0) {
    console.log(chalk.gray("\n  No sessions yet."));
  } else {
    console.log(chalk.bold("\n📊 Sessions:\n"));

    const sortedSessions = sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    for (const session of sortedSessions.slice(0, 5)) {
      const statusColor = getStatusColor(session.status);

      console.log(
        `  ${chalk.cyan(session.id)} | ${statusColor(session.status.padEnd(10))} | ${session.mode.padEnd(5)} | ${chalk.gray(`${session.iteration} iter`)} | ${chalk.gray(new Date(session.startedAt).toLocaleString())}`
      );
    }

    if (sortedSessions.length > 5) {
      console.log(
        chalk.gray(`\n  ... and ${sortedSessions.length - 5} more sessions.`)
      );
    }
  }

  console.log();
}

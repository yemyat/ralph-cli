import chalk from "chalk";
import { getProjectConfig, getProjectSessions } from "../config.js";
import { getAgent } from "../agents/index.js";

export async function statusCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(chalk.red("Ralph is not initialized for this project."));
    console.log(`Run ${chalk.cyan("ralph init")} first.`);
    return;
  }

  const agent = getAgent(config.agent);

  console.log(chalk.bold("\n📋 Project Status\n"));
  console.log(`  Project:    ${chalk.cyan(config.projectName)}`);
  console.log(`  Path:       ${chalk.gray(config.projectPath)}`);
  console.log(`  Agent:      ${chalk.cyan(agent.name)}`);
  console.log(`  Model:      ${chalk.cyan(config.model || "default")}`);
  console.log(`  Created:    ${chalk.gray(config.createdAt)}`);

  const sessions = await getProjectSessions(config.projectId);

  if (sessions.length === 0) {
    console.log(chalk.gray("\n  No sessions yet."));
  } else {
    console.log(chalk.bold("\n📊 Sessions:\n"));

    const sortedSessions = sessions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    for (const session of sortedSessions.slice(0, 5)) {
      const statusColor =
        session.status === "running"
          ? chalk.green
          : session.status === "paused"
          ? chalk.yellow
          : session.status === "completed"
          ? chalk.blue
          : chalk.gray;

      console.log(
        `  ${chalk.cyan(session.id)} | ${statusColor(session.status.padEnd(10))} | ${session.mode.padEnd(5)} | ${chalk.gray(session.iteration + " iter")} | ${chalk.gray(new Date(session.startedAt).toLocaleString())}`
      );
    }

    if (sortedSessions.length > 5) {
      console.log(chalk.gray(`\n  ... and ${sortedSessions.length - 5} more sessions.`));
    }
  }

  console.log();
}

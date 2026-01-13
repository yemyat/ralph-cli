import chalk from "chalk";
import { getAgent } from "../agents/index.js";
import { getProjectConfig, getProjectSessions } from "../config.js";

export async function listCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(chalk.yellow("\nNo Ralph project found in current directory."));
    console.log(
      `Run ${chalk.cyan("ralph-wiggum-cli init")} to initialize a project.`
    );
    return;
  }

  const agent = getAgent(config.agent);
  const sessions = await getProjectSessions(projectPath);
  const runningSessions = sessions.filter((s) => s.status === "running");

  const statusIndicator =
    runningSessions.length > 0 ? chalk.green("●") : chalk.gray("○");

  console.log(chalk.bold("\n📁 Ralph Project\n"));
  console.log(`${statusIndicator} ${chalk.cyan(config.projectName)}`);
  console.log(`    Agent:    ${chalk.gray(agent.name)}`);
  console.log(`    Model:    ${chalk.gray(config.model || "default")}`);
  console.log(
    `    Sessions: ${chalk.gray(sessions.length)} total, ${chalk.green(runningSessions.length)} running`
  );
  console.log();
}

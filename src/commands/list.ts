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

  const planAgent = getAgent(config.agents.plan.agent);
  const buildAgent = getAgent(config.agents.build.agent);
  const sessions = await getProjectSessions(projectPath);
  const runningSessions = sessions.filter((s) => s.status === "running");

  const statusIndicator =
    runningSessions.length > 0 ? chalk.green("●") : chalk.gray("○");

  console.log(chalk.bold("\n📁 Ralph Project\n"));
  console.log(`${statusIndicator} ${chalk.cyan(config.projectName)}`);
  console.log(
    `    Plan:     ${chalk.gray(planAgent.name)} ${chalk.gray(`(${config.agents.plan.model || "default"})`)}`
  );
  console.log(
    `    Build:    ${chalk.gray(buildAgent.name)} ${chalk.gray(`(${config.agents.build.model || "default"})`)}`
  );
  console.log(
    `    Sessions: ${chalk.gray(sessions.length)} total, ${chalk.green(runningSessions.length)} running`
  );
  console.log();
}

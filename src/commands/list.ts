import chalk from "chalk";
import { getAllProjects, getAllSessions } from "../config.js";
import { getAgent } from "../agents/index.js";

export async function listCommand(): Promise<void> {
  const projects = await getAllProjects();
  const sessions = await getAllSessions();

  if (projects.length === 0) {
    console.log(chalk.yellow("\nNo Ralph projects found."));
    console.log(`Run ${chalk.cyan("ralph init")} in a project directory to get started.`);
    return;
  }

  console.log(chalk.bold("\n📁 All Ralph Projects\n"));

  for (const project of projects) {
    const agent = getAgent(project.agent);
    const projectSessions = sessions.filter((s) => s.projectId === project.projectId);
    const runningSessions = projectSessions.filter((s) => s.status === "running");

    const statusIndicator = runningSessions.length > 0 ? chalk.green("●") : chalk.gray("○");

    console.log(`${statusIndicator} ${chalk.cyan(project.projectName)}`);
    console.log(`    Path:     ${chalk.gray(project.projectPath)}`);
    console.log(`    Agent:    ${chalk.gray(agent.name)}`);
    console.log(`    Sessions: ${chalk.gray(projectSessions.length)} total, ${chalk.green(runningSessions.length)} running`);
    console.log();
  }

  // Summary
  const totalRunning = sessions.filter((s) => s.status === "running").length;
  console.log(chalk.gray(`─────────────────────────────────────`));
  console.log(`Total: ${chalk.cyan(projects.length)} projects, ${chalk.green(totalRunning)} running sessions`);
  console.log();
}

import chalk from "chalk";
import {
  getProjectConfig,
  getProjectSessions,
  saveSession,
} from "../config.js";

export async function stopCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(chalk.red("Ralph is not initialized for this project."));
    return;
  }

  const sessions = await getProjectSessions(projectPath);
  const runningSessions = sessions.filter((s) => s.status === "running");

  if (runningSessions.length === 0) {
    console.log(
      chalk.yellow("No running Ralph sessions found for this project.")
    );
    return;
  }

  for (const session of runningSessions) {
    if (session.pid) {
      try {
        process.kill(session.pid, "SIGTERM");
        console.log(
          chalk.green(
            `✓ Sent stop signal to session ${session.id} (PID: ${session.pid})`
          )
        );
      } catch (_err) {
        console.log(chalk.gray(`Process ${session.pid} already terminated.`));
      }
    }

    session.status = "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(projectPath, session);
  }

  console.log(chalk.green(`\n✓ Stopped ${runningSessions.length} session(s).`));
}

import chalk from "chalk";
import fse from "fs-extra";
import { getProjectConfig, getProjectSessions, getSession } from "../config.js";
import type { RalphSession } from "../types.js";

interface LogsOptions {
  sessionId?: string;
  lines?: number;
  follow?: boolean;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  let session: RalphSession | null | undefined;

  if (options.sessionId) {
    session = await getSession(options.sessionId);
    if (!session) {
      console.log(chalk.red(`Session not found: ${options.sessionId}`));
      return;
    }
  } else {
    const projectPath = process.cwd();
    const config = await getProjectConfig(projectPath);

    if (!config) {
      console.log(chalk.red("Ralph is not initialized for this project."));
      return;
    }

    const sessions = await getProjectSessions(config.projectId);
    const sortedSessions = sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    if (sortedSessions.length === 0) {
      console.log(chalk.yellow("No sessions found for this project."));
      return;
    }

    session = sortedSessions[0];
  }

  if (!(await fse.pathExists(session.logFile))) {
    console.log(chalk.yellow(`Log file not found: ${session.logFile}`));
    return;
  }

  const lines = options.lines || 50;

  if (options.follow) {
    console.log(chalk.gray(`Following logs for session ${session.id}...`));
    console.log(chalk.gray("Press Ctrl+C to stop.\n"));

    const { spawn } = await import("node:child_process");
    const tail = spawn("tail", ["-f", "-n", String(lines), session.logFile], {
      stdio: "inherit",
    });

    process.on("SIGINT", () => {
      tail.kill();
      process.exit(0);
    });
  } else {
    const content = await fse.readFile(session.logFile, "utf-8");
    const allLines = content.split("\n");
    const lastLines = allLines.slice(-lines);

    console.log(chalk.bold(`\n📜 Logs for session ${session.id}\n`));
    console.log(lastLines.join("\n"));
  }
}

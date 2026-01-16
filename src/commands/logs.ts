import fse from "fs-extra";
import pc from "picocolors";
import { getProjectConfig, getProjectSessions, getSession } from "../config";
import type { RalphSession } from "../types";
import { getSessionLogFile } from "../utils/paths";

interface LogsOptions {
  sessionId?: string;
  lines?: number;
  follow?: boolean;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  const projectPath = process.cwd();
  let session: RalphSession | null | undefined;

  if (options.sessionId) {
    session = await getSession(projectPath, options.sessionId);
    if (!session) {
      console.log(pc.red(`Session not found: ${options.sessionId}`));
      return;
    }
  } else {
    const config = await getProjectConfig(projectPath);

    if (!config) {
      console.log(pc.red("Ralph is not initialized for this project."));
      return;
    }

    const sessions = await getProjectSessions(projectPath);
    const sortedSessions = sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    if (sortedSessions.length === 0) {
      console.log(pc.yellow("No sessions found for this project."));
      return;
    }

    session = sortedSessions[0];
  }

  const logFile = getSessionLogFile(projectPath, session.id);

  if (!(await fse.pathExists(logFile))) {
    console.log(pc.yellow(`Log file not found: ${logFile}`));
    return;
  }

  const lines = options.lines || 50;

  if (options.follow) {
    console.log(pc.gray(`Following logs for session ${session.id}...`));
    console.log(pc.gray("Press Ctrl+C to stop.\n"));

    const { spawn } = await import("node:child_process");
    const tail = spawn("tail", ["-f", "-n", String(lines), logFile], {
      stdio: "inherit",
    });

    process.on("SIGINT", () => {
      tail.kill();
      process.exit(0);
    });
  } else {
    const content = await fse.readFile(logFile, "utf-8");
    const allLines = content.split("\n");
    const lastLines = allLines.slice(-lines);

    console.log(pc.bold(`\n📜 Logs for session ${session.id}\n`));
    console.log(lastLines.join("\n"));
  }
}

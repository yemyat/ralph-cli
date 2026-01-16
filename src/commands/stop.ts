import pc from "picocolors";
import {
  getProjectConfig,
  getProjectSessions,
  saveSession,
} from "../config";

export async function stopCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(pc.red("Ralph is not initialized for this project."));
    return;
  }

  const sessions = await getProjectSessions(projectPath);
  const runningSessions = sessions.filter((s) => s.status === "running");

  if (runningSessions.length === 0) {
    console.log(pc.yellow("No running Ralph sessions found for this project."));
    return;
  }

  for (const session of runningSessions) {
    if (session.pid) {
      try {
        process.kill(session.pid, "SIGTERM");
        console.log(
          pc.green(
            `✓ Sent stop signal to session ${session.id} (PID: ${session.pid})`
          )
        );
      } catch (_err) {
        console.log(pc.gray(`Process ${session.pid} already terminated.`));
      }
    }

    session.status = "stopped";
    session.stoppedAt = new Date().toISOString();
    await saveSession(projectPath, session);
  }

  console.log(pc.green(`\n✓ Stopped ${runningSessions.length} session(s).`));
}

import pc from "picocolors";
import { Workspace } from "../domain/workspace";

export async function stopCommand(): Promise<void> {
  const workspace = await Workspace.load();

  if (!workspace) {
    console.log(pc.red("Ralph is not initialized for this project."));
    return;
  }

  const runningSessions = workspace.runningSessions;

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
    await workspace.updateSession(session);
  }

  console.log(pc.green(`\n✓ Stopped ${runningSessions.length} session(s).`));
}

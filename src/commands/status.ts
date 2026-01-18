import pc from "picocolors";
import { getAgent } from "../agents/index";
import type { Session } from "../domain/session";
import { Workspace } from "../domain/workspace";

function getStatusColor(status: Session["status"]): typeof pc.green {
  switch (status) {
    case "running":
      return pc.green;
    case "paused":
      return pc.yellow;
    case "completed":
      return pc.blue;
    default:
      return pc.gray;
  }
}

export async function statusCommand(): Promise<void> {
  const workspace = await Workspace.load();

  if (!workspace) {
    console.log(pc.red("Ralph is not initialized for this project."));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli init")} first.`);
    return;
  }

  const { config, sessionManager } = workspace;
  const planAgent = getAgent(config.agents.plan.agent);
  const buildAgent = getAgent(config.agents.build.agent);
  const sessions = sessionManager.all;

  console.log(pc.bold("\n📋 Project Status\n"));
  console.log(`  Project:     ${pc.cyan(config.projectName)}`);
  console.log(
    `  Plan Agent:  ${pc.cyan(planAgent.name)} ${pc.gray(`(model: ${config.agents.plan.model || "default"})`)}`
  );
  console.log(
    `  Build Agent: ${pc.cyan(buildAgent.name)} ${pc.gray(`(model: ${config.agents.build.model || "default"})`)}`
  );
  console.log(`  Created:     ${pc.gray(config.createdAt)}`);

  if (sessions.length === 0) {
    console.log(pc.gray("\n  No sessions yet."));
  } else {
    console.log(pc.bold("\n📊 Sessions:\n"));

    const sortedSessions = sessions.toSorted(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    for (const session of sortedSessions.slice(0, 5)) {
      const statusColor = getStatusColor(session.status);

      console.log(
        `  ${pc.cyan(session.id)} | ${statusColor(session.status.padEnd(10))} | ${session.mode.padEnd(5)} | ${pc.gray(`${session.iteration} iter`)} | ${pc.gray(new Date(session.startedAt).toLocaleString())}`
      );
    }

    if (sortedSessions.length > 5) {
      console.log(
        pc.gray(`\n  ... and ${sortedSessions.length - 5} more sessions.`)
      );
    }
  }

  console.log();
}

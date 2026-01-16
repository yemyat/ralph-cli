import pc from "picocolors";
import { getAgent } from "../agents/index";
import { getProjectConfig, getProjectSessions } from "../config";

export async function listCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(pc.yellow("\nNo Ralph project found in current directory."));
    console.log(
      `Run ${pc.cyan("ralph-wiggum-cli init")} to initialize a project.`
    );
    return;
  }

  const planAgent = getAgent(config.agents.plan.agent);
  const buildAgent = getAgent(config.agents.build.agent);
  const sessions = await getProjectSessions(projectPath);
  const runningSessions = sessions.filter((s) => s.status === "running");

  const statusIndicator =
    runningSessions.length > 0 ? pc.green("●") : pc.gray("○");

  console.log(pc.bold("\n📁 Ralph Project\n"));
  console.log(`${statusIndicator} ${pc.cyan(config.projectName)}`);
  console.log(
    `    Plan:     ${pc.gray(planAgent.name)} ${pc.gray(`(${config.agents.plan.model || "default"})`)}`
  );
  console.log(
    `    Build:    ${pc.gray(buildAgent.name)} ${pc.gray(`(${config.agents.build.model || "default"})`)}`
  );
  console.log(
    `    Sessions: ${pc.gray(sessions.length)} total, ${pc.green(runningSessions.length)} running`
  );
  console.log();
}

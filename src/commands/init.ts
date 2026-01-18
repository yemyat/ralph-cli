import { join } from "node:path";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { getAgent, getAllAgents } from "../agents/index";
import { getProjectConfig, initProject } from "../config";
import { Implementation } from "../domain";
import {
  GUARDRAILS_TEMPLATE,
  PROGRESS_TEMPLATE,
  PROMPT_PLAN,
  SPEC_TEMPLATE,
} from "../templates/prompts";
import type { AgentType, InitOptions, TelegramConfig } from "../types";
import { getRalphDir, getSpecsDir, RALPH_LOGS_DIR } from "../utils/paths";

async function createProjectFiles(projectPath: string): Promise<void> {
  const ralphDir = getRalphDir(projectPath);
  const specsDir = getSpecsDir(projectPath);

  const ensureFile = async (path: string, content: string) => {
    if (!(await fse.pathExists(path))) {
      await fse.writeFile(path, content);
    }
  };

  await ensureFile(join(ralphDir, "PROMPT_plan.md"), PROMPT_PLAN);
  await ensureFile(join(ralphDir, "PROGRESS.md"), PROGRESS_TEMPLATE);
  await ensureFile(join(ralphDir, "GUARDRAILS.md"), GUARDRAILS_TEMPLATE);

  const implPath = join(ralphDir, "implementation.json");
  if (!(await fse.pathExists(implPath))) {
    const impl = Implementation.createEmpty(projectPath);
    await impl.save("user");
  }

  const specsFiles = await fse.readdir(specsDir);
  if (specsFiles.length === 0) {
    await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);
  }

  // Add logs to .gitignore
  const gitignorePath = join(projectPath, ".gitignore");
  const logsPattern = `.ralph-wiggum/${RALPH_LOGS_DIR}/`;
  let gitignore = "";
  if (await fse.pathExists(gitignorePath)) {
    gitignore = await fse.readFile(gitignorePath, "utf-8");
    if (gitignore.includes(logsPattern)) {
      return;
    }
    if (!gitignore.endsWith("\n")) {
      gitignore += "\n";
    }
  }
  gitignore += `\n# Ralph Wiggum logs\n${logsPattern}\n`;
  await fse.writeFile(gitignorePath, gitignore);
}

async function promptTelegram(): Promise<TelegramConfig | undefined> {
  const enable = await confirm({
    message: "Enable Telegram notifications?",
    initialValue: false,
  });
  if (isCancel(enable) || !enable) {
    return undefined;
  }

  const botToken = await text({
    message: "Telegram bot token:",
    validate: (v) => (v?.includes(":") ? undefined : "Invalid token format"),
  });
  if (isCancel(botToken)) {
    return undefined;
  }

  const chatId = await text({
    message: "Telegram chat ID:",
    validate: (v) => (v?.trim() ? undefined : "Required"),
  });
  if (isCancel(chatId)) {
    return undefined;
  }

  return { botToken: botToken.trim(), chatId: chatId.trim(), enabled: true };
}

async function selectAgent(
  message: string,
  initial: AgentType
): Promise<AgentType> {
  const options = getAllAgents().map((a) => ({
    label: `${a.name} (${a.type})`,
    value: a.type,
  }));
  const result = await select({ message, options, initialValue: initial });
  if (isCancel(result)) {
    cancel("Setup cancelled");
    process.exit(0);
  }
  return result as AgentType;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectPath = process.cwd();

  intro(pc.cyan("🧑‍🚀 Ralph Wiggum CLI Setup"));

  // Check existing config
  const existing = await getProjectConfig(projectPath);
  if (existing && !options.force) {
    note(
      `Plan Agent:  ${existing.agents.plan.agent}\n` +
        `Build Agent: ${existing.agents.build.agent}`,
      "Already initialized"
    );
    log.warning("Use --force to reinitialize.");
    outro("Setup cancelled");
    return;
  }

  // Determine agents
  let planAgent = options.planAgent || options.agent || "claude";
  let buildAgent = options.buildAgent || options.agent || "claude";

  if (!(options.planAgent || options.agent)) {
    planAgent = await selectAgent("Select agent for PLANNING:", "claude");
  }
  if (!(options.buildAgent || options.agent)) {
    buildAgent = await selectAgent("Select agent for BUILDING:", planAgent);
  }

  // Check agents installed
  for (const [role, agentType] of [
    ["plan", planAgent],
    ["build", buildAgent],
  ] as const) {
    const agent = getAgent(agentType);
    if (!(await agent.checkInstalled())) {
      log.error(`${agent.name} (${role} agent) is not installed.`);
      note(agent.getInstallInstructions(), "Installation");
      outro("Setup incomplete");
      return;
    }
  }

  const telegram = await promptTelegram();

  const s = spinner();
  s.start("Initializing...");

  const config = await initProject(projectPath, {
    planAgent,
    planModel: options.planModel || options.model,
    buildAgent,
    buildModel: options.buildModel || options.model,
    notifications: telegram ? { telegram } : undefined,
  });

  await createProjectFiles(projectPath);

  s.stop("Done");

  log.success("Ralph initialized!");

  const telegramStatus = config.notifications?.telegram?.enabled
    ? pc.green("enabled")
    : pc.gray("disabled");

  note(
    `Project:     ${config.projectName}\n` +
      `Plan Agent:  ${getAgent(planAgent).name}\n` +
      `Build Agent: ${getAgent(buildAgent).name}\n` +
      `Telegram:    ${telegramStatus}`,
    "Configuration"
  );

  outro(
    "Next:\n" +
      `  1. Add specs to ${pc.cyan(".ralph-wiggum/specs/")}\n` +
      `  2. Run ${pc.cyan("ralph-wiggum-cli plan")}\n` +
      `  3. Run ${pc.cyan("ralph-wiggum-cli build")}`
  );
}

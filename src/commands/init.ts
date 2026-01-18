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
import pc from "picocolors";
import { getAgent, getAllAgents } from "../agents/index";
import { Workspace } from "../domain/workspace";
import type { AgentType, InitOptions, TelegramConfig } from "../types";

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
  intro(pc.cyan("🧑‍🚀 Ralph Wiggum CLI Setup"));

  const existing = await Workspace.load();
  if (existing && !options.force) {
    note(
      `Plan Agent:  ${existing.config.agents.plan.agent}\n` +
        `Build Agent: ${existing.config.agents.build.agent}`,
      "Already initialized"
    );
    log.warning("Use --force to reinitialize.");
    outro("Setup cancelled");
    return;
  }

  let planAgent = options.planAgent || options.agent || "claude";
  let buildAgent = options.buildAgent || options.agent || "claude";

  if (!(options.planAgent || options.agent)) {
    planAgent = await selectAgent("Select agent for PLANNING:", "claude");
  }
  if (!(options.buildAgent || options.agent)) {
    buildAgent = await selectAgent("Select agent for BUILDING:", planAgent);
  }

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

  const workspace = await Workspace.init({
    planAgent,
    planModel: options.planModel || options.model,
    buildAgent,
    buildModel: options.buildModel || options.model,
    notifications: telegram ? { telegram } : undefined,
  });

  await workspace.ensureProjectFiles();

  s.stop("Done");

  log.success("Ralph initialized!");

  const telegramStatus = workspace.config.notifications?.telegram?.enabled
    ? pc.green("enabled")
    : pc.gray("disabled");

  note(
    `Project:     ${workspace.config.projectName}\n` +
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

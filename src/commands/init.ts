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
import type { AgentType, RalphConfig, TelegramConfig } from "../types";
import { type InitializeProjectResult, initializeProject } from "./init-logic";

interface InitOptions {
  agent?: AgentType;
  model?: string;
  planAgent?: AgentType;
  planModel?: string;
  buildAgent?: AgentType;
  buildModel?: string;
  force?: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
}

async function promptForTelegramConfig(
  options: InitOptions
): Promise<TelegramConfig | undefined> {
  if (options.telegramBotToken && options.telegramChatId) {
    return {
      botToken: options.telegramBotToken,
      chatId: options.telegramChatId,
      enabled: true,
    };
  }

  const enableTelegram = await confirm({
    message: "Enable Telegram notifications?",
    initialValue: false,
  });

  if (isCancel(enableTelegram) || !enableTelegram) {
    return undefined;
  }

  const botToken = await text({
    message: "Enter your Telegram bot token:",
    placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    validate: (value) => {
      if (!value?.trim()) {
        return "Bot token is required";
      }
      if (!value.includes(":")) {
        return "Invalid bot token format";
      }
      return undefined;
    },
  });

  if (isCancel(botToken)) {
    return undefined;
  }

  const chatId = await text({
    message: "Enter your Telegram chat ID:",
    placeholder: "-1001234567890 or 123456789",
    validate: (value) => (value?.trim() ? undefined : "Chat ID is required"),
  });

  if (isCancel(chatId)) {
    return undefined;
  }

  return { botToken: botToken.trim(), chatId: chatId.trim(), enabled: true };
}

interface AgentOption {
  label: string;
  value: AgentType;
}

async function selectAgent(
  message: string,
  agentOptions: AgentOption[],
  initialValue: AgentType
): Promise<AgentType> {
  const result = await select({ message, options: agentOptions, initialValue });
  if (isCancel(result)) {
    cancel("Setup cancelled");
    process.exit(0);
  }
  return result as AgentType;
}

function handleInitError(result: InitializeProjectResult): void {
  if (result.error?.type === "already_initialized" && result.config) {
    const c = result.config;
    note(
      `Plan Agent:  ${c.agents.plan.agent}\n` +
        `Plan Model:  ${c.agents.plan.model || "default"}\n` +
        `Build Agent: ${c.agents.build.agent}\n` +
        `Build Model: ${c.agents.build.model || "default"}`,
      "Ralph is already initialized"
    );
    log.warning("Use --force to reinitialize.");
    outro("Setup cancelled");
    return;
  }

  if (result.error?.type === "agent_not_installed") {
    log.error(result.error.message);
    note(result.error.installInstructions || "", "Installation instructions");
    log.info("After installing, run `ralph-wiggum-cli init` again.");
    outro("Setup incomplete");
    return;
  }

  outro("Setup failed");
}

function showSuccessOutput(
  config: RalphConfig,
  planAgent: AgentType,
  buildAgent: AgentType
): void {
  const planAgentInstance = getAgent(planAgent);
  const buildAgentInstance = getAgent(buildAgent);

  log.success("Ralph initialized successfully!");

  const telegramStatus = config.notifications?.telegram?.enabled
    ? pc.green("enabled")
    : pc.gray("disabled");

  note(
    `Project:     ${config.projectName}\n` +
      `Plan Agent:  ${planAgentInstance.name} (model: ${config.agents.plan.model || "default"})\n` +
      `Build Agent: ${buildAgentInstance.name} (model: ${config.agents.build.model || "default"})\n` +
      `Telegram:    ${telegramStatus}`,
    "Configuration"
  );

  note(
    "- PROMPT_plan.md         (planning mode prompt)\n" +
      "- GUARDRAILS.md          (compliance rules)\n" +
      "- implementation.json    (task-level orchestration)\n" +
      "- PROGRESS.md            (audit trail)\n" +
      "- specs/                 (specs with tasks + acceptance criteria)\n" +
      "- logs/                  (session logs, gitignored)",
    "Created .ralph-wiggum/ directory"
  );

  outro(
    "Next steps:\n" +
      `  1. Add specifications to ${pc.cyan(".ralph-wiggum/specs/")} directory\n` +
      `  2. Run ${pc.cyan("ralph-wiggum-cli start plan")} to generate implementation plan\n` +
      `  3. Run ${pc.cyan("ralph-wiggum-cli start build")} to start building`
  );
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectPath = process.cwd();

  intro(pc.cyan("🧑‍🚀 Ralph Wiggum CLI Setup"));

  const agents = getAllAgents();
  const agentOptions = agents.map((a) => ({
    label: `${a.name} (${a.type})`,
    value: a.type,
  }));

  let planAgent: AgentType = options.planAgent || options.agent || "claude";
  let buildAgent: AgentType = options.buildAgent || options.agent || "claude";

  if (!(options.planAgent || options.agent)) {
    planAgent = await selectAgent(
      "Select an AI agent for PLANNING:",
      agentOptions,
      "claude"
    );
  }

  if (!(options.buildAgent || options.agent)) {
    buildAgent = await selectAgent(
      "Select an AI agent for BUILDING:",
      agentOptions,
      planAgent
    );
  }

  const telegramConfig = await promptForTelegramConfig(options);

  const s = spinner();
  s.start("Initializing project...");

  const result = await initializeProject({
    projectPath,
    planAgent,
    planModel: options.planModel || options.model,
    buildAgent,
    buildModel: options.buildModel || options.model,
    telegramConfig,
    force: options.force,
  });

  s.stop(result.success ? "Project configured" : "Initialization failed");

  if (!result.success) {
    handleInitError(result);
    return;
  }

  showSuccessOutput(result.config as RalphConfig, planAgent, buildAgent);
}

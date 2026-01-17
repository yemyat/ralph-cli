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
import {
  GUARDRAILS_TEMPLATE,
  IMPLEMENTATION_PLAN_TEMPLATE,
  PROGRESS_TEMPLATE,
  PROMPT_BUILD,
  PROMPT_PLAN,
  SPEC_TEMPLATE,
} from "../templates/prompts";
import type { AgentType, TelegramConfig } from "../types";
import {
  createEmptyImplementation,
  saveImplementation,
} from "../utils/implementation";
import { getRalphDir, getSpecsDir, RALPH_LOGS_DIR } from "../utils/paths";

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

async function addLogsToGitignore(projectPath: string): Promise<void> {
  const gitignorePath = join(projectPath, ".gitignore");
  const logsPattern = `.ralph-wiggum/${RALPH_LOGS_DIR}/`;

  let content = "";
  if (await fse.pathExists(gitignorePath)) {
    content = await fse.readFile(gitignorePath, "utf-8");
    if (content.includes(logsPattern)) {
      return;
    }
    if (!content.endsWith("\n")) {
      content += "\n";
    }
  }

  content += `\n# Ralph Wiggum logs\n${logsPattern}\n`;
  await fse.writeFile(gitignorePath, content);
}

async function ensureFile(path: string, content: string): Promise<void> {
  if (!(await fse.pathExists(path))) {
    await fse.writeFile(path, content);
  }
}

async function createProjectFiles(projectPath: string): Promise<void> {
  const ralphDir = getRalphDir(projectPath);
  const specsDir = getSpecsDir(projectPath);

  await ensureFile(join(ralphDir, "PROMPT_plan.md"), PROMPT_PLAN);
  await ensureFile(join(ralphDir, "PROMPT_build.md"), PROMPT_BUILD);
  await ensureFile(
    join(ralphDir, "IMPLEMENTATION_PLAN.md"),
    IMPLEMENTATION_PLAN_TEMPLATE
  );
  await ensureFile(join(ralphDir, "PROGRESS.md"), PROGRESS_TEMPLATE);
  await ensureFile(join(ralphDir, "GUARDRAILS.md"), GUARDRAILS_TEMPLATE);

  // Create implementation.json for task-level orchestration
  const implPath = join(ralphDir, "implementation.json");
  if (!(await fse.pathExists(implPath))) {
    const emptyImpl = createEmptyImplementation();
    await saveImplementation(projectPath, emptyImpl, "user");
  }

  const specsFiles = await fse.readdir(specsDir);
  if (specsFiles.length === 0) {
    await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);
  }

  await addLogsToGitignore(projectPath);
}

async function promptForTelegramConfig(
  options: InitOptions
): Promise<TelegramConfig | undefined> {
  // If both token and chat ID are provided via CLI options, use them directly
  if (options.telegramBotToken && options.telegramChatId) {
    return {
      botToken: options.telegramBotToken,
      chatId: options.telegramChatId,
      enabled: true,
    };
  }

  // Ask user if they want to enable Telegram notifications
  const enableTelegram = await confirm({
    message: "Enable Telegram notifications?",
    initialValue: false,
  });

  if (isCancel(enableTelegram) || !enableTelegram) {
    return undefined;
  }

  // Prompt for bot token
  const botToken = await text({
    message: "Enter your Telegram bot token:",
    placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Bot token is required";
      }
      // Basic validation for Telegram bot token format
      if (!value.includes(":")) {
        return "Invalid bot token format (should contain ':')";
      }
      return undefined;
    },
  });

  if (isCancel(botToken)) {
    return undefined;
  }

  // Prompt for chat ID
  const chatId = await text({
    message: "Enter your Telegram chat ID:",
    placeholder: "-1001234567890 or 123456789",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Chat ID is required";
      }
      return undefined;
    },
  });

  if (isCancel(chatId)) {
    return undefined;
  }

  return {
    botToken: botToken.trim(),
    chatId: chatId.trim(),
    enabled: true,
  };
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
  const result = await select({
    message,
    options: agentOptions,
    initialValue,
  });

  if (isCancel(result)) {
    cancel("Setup cancelled");
    process.exit(0);
  }
  return result as AgentType;
}

interface AgentCheckResult {
  success: boolean;
  name: string;
  instructions?: string;
}

async function checkAgentInstalled(
  agentInstance: ReturnType<typeof getAgent>
): Promise<AgentCheckResult> {
  const installed = await agentInstance.checkInstalled();
  if (!installed) {
    return {
      success: false,
      name: agentInstance.name,
      instructions: agentInstance.getInstallInstructions(),
    };
  }
  return { success: true, name: agentInstance.name };
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectPath = process.cwd();
  const existingConfig = await getProjectConfig(projectPath);

  intro(pc.cyan("🧑‍🚀 Ralph Wiggum CLI Setup"));

  if (existingConfig && !options.force) {
    note(
      `Plan Agent:  ${existingConfig.agents.plan.agent}\n` +
        `Plan Model:  ${existingConfig.agents.plan.model || "default"}\n` +
        `Build Agent: ${existingConfig.agents.build.agent}\n` +
        `Build Model: ${existingConfig.agents.build.model || "default"}`,
      "Ralph is already initialized"
    );
    log.warning("Use --force to reinitialize.");
    outro("Setup cancelled");
    return;
  }

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

  const planAgentInstance = getAgent(planAgent);
  const buildAgentInstance = getAgent(buildAgent);

  const s = spinner();

  // Check if agents are installed
  s.start("Checking agent installations...");

  const planCheck = await checkAgentInstalled(planAgentInstance);
  if (!planCheck.success) {
    s.stop("Agent check failed");
    log.error(`${planCheck.name} (plan agent) is not installed.`);
    note(planCheck.instructions || "", "Installation instructions");
    log.info("After installing, run `ralph-wiggum-cli init` again.");
    outro("Setup incomplete");
    return;
  }

  const buildCheck = await checkAgentInstalled(buildAgentInstance);
  if (!buildCheck.success) {
    s.stop("Agent check failed");
    log.error(`${buildCheck.name} (build agent) is not installed.`);
    note(buildCheck.instructions || "", "Installation instructions");
    log.info("After installing, run `ralph-wiggum-cli init` again.");
    outro("Setup incomplete");
    return;
  }

  s.stop("Agents verified");

  // Prompt for Telegram notifications
  const telegramConfig = await promptForTelegramConfig(options);

  const s2 = spinner();
  s2.start("Creating project configuration...");

  const config = await initProject(projectPath, {
    planAgent,
    planModel: options.planModel || options.model,
    buildAgent,
    buildModel: options.buildModel || options.model,
    notifications: telegramConfig ? { telegram: telegramConfig } : undefined,
  });

  await createProjectFiles(projectPath);

  s2.stop("Project configured");

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
      "- PROMPT_build.md        (building mode prompt)\n" +
      "- GUARDRAILS.md          (compliance rules)\n" +
      "- implementation.json    (task-level orchestration)\n" +
      "- IMPLEMENTATION_PLAN.md (legacy progress tracker)\n" +
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

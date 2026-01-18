import { join } from "node:path";
import fse from "fs-extra";
import { getAgent, getAllAgents } from "../agents/index";
import { getProjectConfig, initProject } from "../config";
import {
  GUARDRAILS_TEMPLATE,
  PROGRESS_TEMPLATE,
  PROMPT_PLAN,
  SPEC_TEMPLATE,
} from "../templates/prompts";
import type { AgentType, RalphConfig, TelegramConfig } from "../types";
import {
  createEmptyImplementation,
  saveImplementation,
} from "../utils/implementation";
import { getRalphDir, getSpecsDir, RALPH_LOGS_DIR } from "../utils/paths";

/**
 * Options for initializeProject() - all values are resolved (no prompts needed)
 */
export interface InitializeProjectOptions {
  projectPath: string;
  planAgent: AgentType;
  planModel?: string;
  buildAgent: AgentType;
  buildModel?: string;
  telegramConfig?: TelegramConfig;
  force?: boolean;
}

/**
 * Result of initializeProject()
 */
export interface InitializeProjectResult {
  success: boolean;
  config?: RalphConfig;
  alreadyInitialized?: boolean;
  error?: {
    type: "already_initialized" | "agent_not_installed";
    message: string;
    agentName?: string;
    installInstructions?: string;
  };
}

/**
 * Result of agent installation check
 */
export interface AgentCheckResult {
  success: boolean;
  name: string;
  instructions?: string;
}

/**
 * Add logs directory to .gitignore if not already present
 */
export async function addLogsToGitignore(projectPath: string): Promise<void> {
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

/**
 * Create a file if it doesn't exist
 */
export async function ensureFile(path: string, content: string): Promise<void> {
  if (!(await fse.pathExists(path))) {
    await fse.writeFile(path, content);
  }
}

/**
 * Create all project files in .ralph-wiggum/ directory
 */
export async function createProjectFiles(projectPath: string): Promise<void> {
  const ralphDir = getRalphDir(projectPath);
  const specsDir = getSpecsDir(projectPath);

  await ensureFile(join(ralphDir, "PROMPT_plan.md"), PROMPT_PLAN);
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

/**
 * Check if an agent is installed and return installation instructions if not
 */
export async function checkAgentInstalled(
  agentType: AgentType
): Promise<AgentCheckResult> {
  const agentInstance = getAgent(agentType);
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

/**
 * Validate that an agent type is valid
 */
export function isValidAgentType(agent: string): agent is AgentType {
  const validAgents = getAllAgents().map((a) => a.type);
  return validAgents.includes(agent as AgentType);
}

/**
 * Initialize a Ralph project - pure logic without interactive prompts
 *
 * This function handles:
 * - Checking if project is already initialized
 * - Validating agents are installed
 * - Creating project configuration
 * - Creating project files
 *
 * @param options - Resolved options (all agent selections already made)
 * @returns Result object with success status, config, or error details
 */
export async function initializeProject(
  options: InitializeProjectOptions
): Promise<InitializeProjectResult> {
  const { projectPath, planAgent, buildAgent, force } = options;

  // Check for existing configuration
  const existingConfig = await getProjectConfig(projectPath);
  if (existingConfig && !force) {
    return {
      success: false,
      alreadyInitialized: true,
      config: existingConfig,
      error: {
        type: "already_initialized",
        message: "Ralph is already initialized in this project",
      },
    };
  }

  // Check plan agent is installed
  const planCheck = await checkAgentInstalled(planAgent);
  if (!planCheck.success) {
    return {
      success: false,
      error: {
        type: "agent_not_installed",
        message: `${planCheck.name} (plan agent) is not installed`,
        agentName: planCheck.name,
        installInstructions: planCheck.instructions,
      },
    };
  }

  // Check build agent is installed
  const buildCheck = await checkAgentInstalled(buildAgent);
  if (!buildCheck.success) {
    return {
      success: false,
      error: {
        type: "agent_not_installed",
        message: `${buildCheck.name} (build agent) is not installed`,
        agentName: buildCheck.name,
        installInstructions: buildCheck.instructions,
      },
    };
  }

  // Create project configuration
  const config = await initProject(projectPath, {
    planAgent,
    planModel: options.planModel,
    buildAgent,
    buildModel: options.buildModel,
    notifications: options.telegramConfig
      ? { telegram: options.telegramConfig }
      : undefined,
  });

  // Create project files
  await createProjectFiles(projectPath);

  return {
    success: true,
    config,
  };
}

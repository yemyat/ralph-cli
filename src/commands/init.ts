import { join } from "node:path";
import {
  cancel,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
} from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { getAgent, getAllAgents } from "../agents/index.js";
import { getProjectConfig, initProject } from "../config.js";
import {
  GUARDRAILS_TEMPLATE,
  IMPLEMENTATION_PLAN_TEMPLATE,
  PROGRESS_TEMPLATE,
  PROMPT_BUILD,
  PROMPT_PLAN,
  SPEC_TEMPLATE,
} from "../templates/prompts.js";
import type { AgentType } from "../types.js";
import { getRalphDir, getSpecsDir, RALPH_LOGS_DIR } from "../utils/paths.js";

interface InitOptions {
  agent?: AgentType;
  model?: string;
  planAgent?: AgentType;
  planModel?: string;
  buildAgent?: AgentType;
  buildModel?: string;
  force?: boolean;
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

  const specsFiles = await fse.readdir(specsDir);
  if (specsFiles.length === 0) {
    await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);
  }

  await addLogsToGitignore(projectPath);
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
    const result = await select({
      message: "Select an AI agent for PLANNING:",
      options: agentOptions,
      initialValue: "claude",
    });

    if (isCancel(result)) {
      cancel("Setup cancelled");
      process.exit(0);
    }
    planAgent = result as AgentType;
  }

  if (!(options.buildAgent || options.agent)) {
    const result = await select({
      message: "Select an AI agent for BUILDING:",
      options: agentOptions,
      initialValue: planAgent,
    });

    if (isCancel(result)) {
      cancel("Setup cancelled");
      process.exit(0);
    }
    buildAgent = result as AgentType;
  }

  const planAgentInstance = getAgent(planAgent);
  const buildAgentInstance = getAgent(buildAgent);

  const s = spinner();

  // Check if agents are installed
  s.start("Checking agent installations...");

  const planInstalled = await planAgentInstance.checkInstalled();
  if (!planInstalled) {
    s.stop("Agent check failed");
    log.error(`${planAgentInstance.name} (plan agent) is not installed.`);
    note(
      planAgentInstance.getInstallInstructions(),
      "Installation instructions"
    );
    log.info("After installing, run `ralph-wiggum-cli init` again.");
    outro("Setup incomplete");
    return;
  }

  const buildInstalled = await buildAgentInstance.checkInstalled();
  if (!buildInstalled) {
    s.stop("Agent check failed");
    log.error(`${buildAgentInstance.name} (build agent) is not installed.`);
    note(
      buildAgentInstance.getInstallInstructions(),
      "Installation instructions"
    );
    log.info("After installing, run `ralph-wiggum-cli init` again.");
    outro("Setup incomplete");
    return;
  }

  s.message("Creating project configuration...");

  const config = await initProject(projectPath, {
    planAgent,
    planModel: options.planModel || options.model,
    buildAgent,
    buildModel: options.buildModel || options.model,
  });

  await createProjectFiles(projectPath);

  s.stop("Project configured");

  log.success("Ralph initialized successfully!");

  note(
    `Project:     ${config.projectName}\n` +
      `Plan Agent:  ${planAgentInstance.name} (model: ${config.agents.plan.model || "default"})\n` +
      `Build Agent: ${buildAgentInstance.name} (model: ${config.agents.build.model || "default"})`,
    "Configuration"
  );

  note(
    "- PROMPT_plan.md         (planning mode prompt)\n" +
      "- PROMPT_build.md        (building mode prompt)\n" +
      "- GUARDRAILS.md          (compliance rules)\n" +
      "- IMPLEMENTATION_PLAN.md (progress orchestrator)\n" +
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

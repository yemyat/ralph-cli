import { join } from "node:path";
import chalk from "chalk";
import fse from "fs-extra";
import inquirer from "inquirer";
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

export async function initCommand(options: InitOptions): Promise<void> {
  const projectPath = process.cwd();
  const existingConfig = await getProjectConfig(projectPath);

  if (existingConfig && !options.force) {
    console.log(chalk.yellow("Ralph is already initialized for this project."));
    console.log(`  Plan Agent:  ${chalk.cyan(existingConfig.agents.plan.agent)}`);
    console.log(`  Plan Model:  ${chalk.cyan(existingConfig.agents.plan.model || "default")}`);
    console.log(`  Build Agent: ${chalk.cyan(existingConfig.agents.build.agent)}`);
    console.log(`  Build Model: ${chalk.cyan(existingConfig.agents.build.model || "default")}`);
    console.log(chalk.gray("\nUse --force to reinitialize."));
    return;
  }

  const agentChoices = getAllAgents().map((a) => ({
    name: `${a.name} (${a.type})`,
    value: a.type,
  }));

  let planAgent: AgentType = options.planAgent || options.agent || "claude";
  let buildAgent: AgentType = options.buildAgent || options.agent || "claude";

  if (!options.planAgent && !options.agent) {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "planAgent",
        message: "Select an AI agent for PLANNING:",
        choices: agentChoices,
        default: "claude",
      },
    ]);
    planAgent = answers.planAgent;
  }

  if (!options.buildAgent && !options.agent) {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "buildAgent",
        message: "Select an AI agent for BUILDING:",
        choices: agentChoices,
        default: planAgent,
      },
    ]);
    buildAgent = answers.buildAgent;
  }

  const planAgentInstance = getAgent(planAgent);
  const buildAgentInstance = getAgent(buildAgent);

  const planInstalled = await planAgentInstance.checkInstalled();
  if (!planInstalled) {
    console.log(chalk.red(`\n${planAgentInstance.name} (plan agent) is not installed.\n`));
    console.log(planAgentInstance.getInstallInstructions());
    console.log(
      chalk.gray("\nAfter installing, run `ralph-wiggum-cli init` again.")
    );
    return;
  }

  const buildInstalled = await buildAgentInstance.checkInstalled();
  if (!buildInstalled) {
    console.log(chalk.red(`\n${buildAgentInstance.name} (build agent) is not installed.\n`));
    console.log(buildAgentInstance.getInstallInstructions());
    console.log(
      chalk.gray("\nAfter installing, run `ralph-wiggum-cli init` again.")
    );
    return;
  }

  const config = await initProject(projectPath, {
    planAgent,
    planModel: options.planModel || options.model,
    buildAgent,
    buildModel: options.buildModel || options.model,
  });

  const ralphDir = getRalphDir(projectPath);
  const specsDir = getSpecsDir(projectPath);

  const promptPlanPath = join(ralphDir, "PROMPT_plan.md");
  const promptBuildPath = join(ralphDir, "PROMPT_build.md");
  const implPlanPath = join(ralphDir, "IMPLEMENTATION_PLAN.md");
  const progressPath = join(ralphDir, "PROGRESS.md");
  const guardrailsPath = join(ralphDir, "GUARDRAILS.md");

  if (!(await fse.pathExists(promptPlanPath))) {
    await fse.writeFile(promptPlanPath, PROMPT_PLAN);
  }

  if (!(await fse.pathExists(promptBuildPath))) {
    await fse.writeFile(promptBuildPath, PROMPT_BUILD);
  }

  if (!(await fse.pathExists(implPlanPath))) {
    await fse.writeFile(implPlanPath, IMPLEMENTATION_PLAN_TEMPLATE);
  }

  if (!(await fse.pathExists(progressPath))) {
    await fse.writeFile(progressPath, PROGRESS_TEMPLATE);
  }

  if (!(await fse.pathExists(guardrailsPath))) {
    await fse.writeFile(guardrailsPath, GUARDRAILS_TEMPLATE);
  }

  const specsFiles = await fse.readdir(specsDir);
  if (specsFiles.length === 0) {
    await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);
  }

  await addLogsToGitignore(projectPath);

  console.log(chalk.green("\n✓ Ralph initialized successfully!\n"));
  console.log(`  Project:     ${chalk.cyan(config.projectName)}`);
  console.log(`  Plan Agent:  ${chalk.cyan(planAgentInstance.name)} ${chalk.gray(`(model: ${config.agents.plan.model || "default"})`)}`);
  console.log(`  Build Agent: ${chalk.cyan(buildAgentInstance.name)} ${chalk.gray(`(model: ${config.agents.build.model || "default"})`)}`);
  console.log();
  console.log(chalk.gray("Created .ralph-wiggum/ directory with:"));
  console.log(chalk.gray("  - PROMPT_plan.md         (planning mode prompt)"));
  console.log(chalk.gray("  - PROMPT_build.md        (building mode prompt)"));
  console.log(chalk.gray("  - GUARDRAILS.md          (compliance rules)"));
  console.log(chalk.gray("  - IMPLEMENTATION_PLAN.md (progress orchestrator)"));
  console.log(chalk.gray("  - PROGRESS.md            (audit trail)"));
  console.log(chalk.gray("  - specs/                 (specs with tasks + acceptance criteria)"));
  console.log(chalk.gray("  - logs/                  (session logs, gitignored)"));
  console.log();
  console.log("Next steps:");
  console.log(
    `  1. Add specifications to ${chalk.cyan(".ralph-wiggum/specs/")} directory`
  );
  console.log(
    `  2. Run ${chalk.cyan("ralph-wiggum-cli start plan")} to generate implementation plan`
  );
  console.log(
    `  3. Run ${chalk.cyan("ralph-wiggum-cli start build")} to start building`
  );
}

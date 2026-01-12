import { join } from "path";
import fse from "fs-extra";
import chalk from "chalk";
import inquirer from "inquirer";
import { initProject, getProjectConfig } from "../config.js";
import { getAgent, getAllAgents } from "../agents/index.js";
import type { AgentType } from "../types.js";
import {
  PROMPT_PLAN,
  PROMPT_BUILD,
  IMPLEMENTATION_PLAN_TEMPLATE,
} from "../templates/prompts.js";

interface InitOptions {
  agent?: AgentType;
  model?: string;
  force?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const projectPath = process.cwd();
  const existingConfig = await getProjectConfig(projectPath);

  if (existingConfig && !options.force) {
    console.log(chalk.yellow("Ralph is already initialized for this project."));
    console.log(`  Agent: ${chalk.cyan(existingConfig.agent)}`);
    console.log(`  Model: ${chalk.cyan(existingConfig.model || "default")}`);
    console.log(chalk.gray("\nUse --force to reinitialize."));
    return;
  }

  // Determine agent to use
  let agent: AgentType = options.agent || "claude";

  if (!options.agent) {
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "agent",
        message: "Select an AI agent:",
        choices: getAllAgents().map((a) => ({
          name: `${a.name} (${a.type})`,
          value: a.type,
        })),
        default: "claude",
      },
    ]);
    agent = answers.agent;
  }

  // Check if agent is installed
  const agentInstance = getAgent(agent);
  const isInstalled = await agentInstance.checkInstalled();

  if (!isInstalled) {
    console.log(chalk.red(`\n${agentInstance.name} is not installed.\n`));
    console.log(agentInstance.getInstallInstructions());
    console.log(chalk.gray("\nAfter installing, run `ralph init` again."));
    return;
  }

  // Initialize project config
  const config = await initProject(projectPath, agent, options.model);

  // Create project files in .ralph directory
  const ralphDir = join(projectPath, ".ralph");
  const specsDir = join(ralphDir, "specs");
  await fse.ensureDir(ralphDir);
  await fse.ensureDir(specsDir);

  // Create prompt files if they don't exist
  const promptPlanPath = join(ralphDir, "PROMPT_plan.md");
  const promptBuildPath = join(ralphDir, "PROMPT_build.md");
  const implPlanPath = join(ralphDir, "IMPLEMENTATION_PLAN.md");

  if (!(await fse.pathExists(promptPlanPath))) {
    await fse.writeFile(promptPlanPath, PROMPT_PLAN);
  }

  if (!(await fse.pathExists(promptBuildPath))) {
    await fse.writeFile(promptBuildPath, PROMPT_BUILD);
  }

  if (!(await fse.pathExists(implPlanPath))) {
    await fse.writeFile(implPlanPath, IMPLEMENTATION_PLAN_TEMPLATE);
  }

  // Create example spec if specs dir is empty
  const specsFiles = await fse.readdir(specsDir);
  if (specsFiles.length === 0) {
    const exampleSpec = `# Example Specification

## Overview
<!-- Describe the feature/component here -->

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Acceptance Criteria
- Feature should...
- User can...
`;
    await fse.writeFile(join(specsDir, "example.md"), exampleSpec);
  }

  console.log(chalk.green("\n✓ Ralph initialized successfully!\n"));
  console.log(`  Project: ${chalk.cyan(config.projectName)}`);
  console.log(`  Agent:   ${chalk.cyan(agentInstance.name)}`);
  console.log(`  Model:   ${chalk.cyan(config.model || "default")}`);
  console.log();
  console.log(chalk.gray("Created .ralph/ directory with:"));
  console.log(chalk.gray("  - PROMPT_plan.md    (planning mode prompt)"));
  console.log(chalk.gray("  - PROMPT_build.md   (building mode prompt)"));
  console.log(chalk.gray("  - IMPLEMENTATION_PLAN.md"));
  console.log(chalk.gray("  - specs/            (specification files)"));
  console.log();
  console.log("Next steps:");
  console.log(`  1. Add specifications to ${chalk.cyan(".ralph/specs/")} directory`);
  console.log(`  2. Run ${chalk.cyan("ralph start plan")} to generate implementation plan`);
  console.log(`  3. Run ${chalk.cyan("ralph start build")} to start building`);
}

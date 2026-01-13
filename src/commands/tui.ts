import chalk from "chalk";
import { render } from "ink";
import React from "react";
import { getProjectConfig } from "../config.js";
import { App } from "../tui/app.js";

export async function tuiCommand(): Promise<void> {
  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(chalk.red("Ralph is not initialized for this project."));
    console.log(`Run ${chalk.cyan("ralph-wiggum-cli init")} first.`);
    return;
  }

  // Clear screen and render the TUI
  console.clear();

  const { waitUntilExit } = render(React.createElement(App, { projectPath }));

  await waitUntilExit();
}

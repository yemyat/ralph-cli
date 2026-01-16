import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import pc from "picocolors";
import { getProjectConfig } from "../config";
import { App } from "../tui/app";

export async function tuiCommand(): Promise<void> {
  // Check if running under Bun
  if (!process.versions.bun) {
    console.log(
      pc.red(
        "Error: The TUI requires Bun runtime. OpenTUI uses native modules that only work with Bun."
      )
    );
    console.log(
      `Run with: ${pc.cyan("bun run ralph-wiggum-cli")} or install globally with ${pc.cyan("bun install -g ralph-wiggum-cli")}`
    );
    process.exit(1);
  }

  const projectPath = process.cwd();
  const config = await getProjectConfig(projectPath);

  if (!config) {
    console.log(pc.red("Ralph is not initialized for this project."));
    console.log(`Run ${pc.cyan("ralph-wiggum-cli init")} first.`);
    return;
  }

  // Clear screen and render the TUI with OpenTUI
  console.clear();

  try {
    const renderer = await createCliRenderer({
      exitOnCtrlC: false, // We handle Ctrl+C ourselves for clean exit
    });

    createRoot(renderer).render(<App projectPath={projectPath} />);
  } catch (err) {
    console.log(pc.red("Error: Failed to initialize OpenTUI render library."));
    console.log(
      pc.gray("This may be due to missing native binaries for your platform.")
    );
    if (err instanceof Error) {
      console.log(pc.gray(`Details: ${err.message}`));
    }
    process.exit(1);
  }
}

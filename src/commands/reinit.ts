import { join } from "node:path";
import { intro, log, note, outro, spinner } from "@clack/prompts";
import fse from "fs-extra";
import pc from "picocolors";
import { getProjectConfig } from "../config";
import { PROMPT_PLAN, SPEC_TEMPLATE } from "../templates/prompts";
import { getRalphDir, getSpecsDir } from "../utils/paths";

export async function reinitCommand(): Promise<void> {
  const projectPath = process.cwd();
  const existingConfig = await getProjectConfig(projectPath);

  intro(pc.cyan("🔄 Ralph Wiggum CLI - Reinitialize Prompts"));

  if (!existingConfig) {
    log.error("Ralph is not initialized in this project.");
    note(
      `Run ${pc.cyan("ralph-wiggum-cli init")} to initialize Ralph first.`,
      "Suggestion"
    );
    outro("Reinit cancelled");
    return;
  }

  const s = spinner();
  s.start("Updating prompts...");

  const ralphDir = getRalphDir(projectPath);
  const specsDir = getSpecsDir(projectPath);

  await fse.writeFile(join(ralphDir, "PROMPT_plan.md"), PROMPT_PLAN);
  await fse.writeFile(join(specsDir, "example.md"), SPEC_TEMPLATE);

  s.stop("Prompts updated");

  log.success("Prompts reinitialized successfully!");

  note(
    "- PROMPT_plan.md  (updated)\n- specs/example.md (created/updated)",
    "Updated files"
  );

  outro("Done!");
}

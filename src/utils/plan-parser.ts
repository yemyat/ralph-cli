// src/utils/plan-parser.ts
// Utility to extract current spec from IMPLEMENTATION_PLAN.md

import { join } from "node:path";
import fse from "fs-extra";
import { getRalphDir } from "./paths";

// Top-level regex patterns for performance (compiled once)
// Matches: "- specs/xxx.md", "- [x] specs/xxx.md", "- [Label](specs/xxx.md)"
const SPEC_REFERENCE_REGEX = /^-\s*(?:\[.?\]\s*)?(specs\/[\w-]+\.md)/;
const MARKDOWN_LINK_REGEX = /^-\s*\[[^\]]+\]\((specs\/[\w-]+\.md)\)/;
const LEADING_NUMBERS_REGEX = /^\d+-/;

/**
 * Extract the current spec being worked on from IMPLEMENTATION_PLAN.md.
 * Returns the spec filename without the "specs/" prefix and ".md" extension.
 *
 * @param projectPath - Path to the project root
 * @returns The current spec name or null if none found
 */
export async function getCurrentSpec(
  projectPath: string
): Promise<string | null> {
  const planPath = join(getRalphDir(projectPath), "IMPLEMENTATION_PLAN.md");

  if (!(await fse.pathExists(planPath))) {
    return null;
  }

  const content = await fse.readFile(planPath, "utf-8");
  return extractCurrentSpecFromContent(content);
}

/**
 * Extract the title from the current spec file.
 * Reads the spec file and extracts the first H1 heading.
 *
 * @param projectPath - Path to the project root
 * @returns The spec title or null if not found
 */
export async function getCurrentSpecTitle(
  projectPath: string
): Promise<string | null> {
  const specName = await getCurrentSpec(projectPath);
  if (!specName) {
    return null;
  }

  const specPath = join(getRalphDir(projectPath), "specs", `${specName}.md`);

  if (!(await fse.pathExists(specPath))) {
    return specNameToTitle(specName);
  }

  const content = await fse.readFile(specPath, "utf-8");
  const firstLine = content.split("\n")[0]?.trim();

  if (firstLine?.startsWith("# ")) {
    return firstLine.slice(2).trim();
  }

  return specNameToTitle(specName);
}

/**
 * Extract the current spec from IMPLEMENTATION_PLAN.md content.
 * Looks for the first spec in the "In Progress" section.
 *
 * @param content - The raw content of IMPLEMENTATION_PLAN.md
 * @returns The spec name or null if none found
 */
export function extractCurrentSpecFromContent(content: string): string | null {
  const lines = content.split("\n");
  let inProgressSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect "In Progress" section
    if (trimmed.startsWith("## In Progress")) {
      inProgressSection = true;
      continue;
    }

    // Exit when we hit another section
    if (inProgressSection && trimmed.startsWith("## ")) {
      break;
    }

    // Skip if not in In Progress section or line is empty/comment
    if (!(inProgressSection && trimmed) || trimmed.startsWith("<!--")) {
      continue;
    }

    // Parse spec reference (e.g., "- specs/001-feature.md" or "- [Label](specs/xxx.md)")
    const specMatch = trimmed.match(SPEC_REFERENCE_REGEX);
    if (specMatch) {
      const specPath = specMatch[1];
      return extractSpecName(specPath);
    }

    // Try markdown link format (e.g., "- [Telegram Notifications](specs/011-telegram.md)")
    const linkMatch = trimmed.match(MARKDOWN_LINK_REGEX);
    if (linkMatch) {
      const specPath = linkMatch[1];
      return extractSpecName(specPath);
    }
  }

  return null;
}

/**
 * Extract a readable name from a spec path.
 * Example: "specs/011-telegram-notifications.md" -> "011-telegram-notifications"
 *
 * @param specPath - The spec path like "specs/001-feature.md"
 * @returns The spec filename without directory and extension
 */
export function extractSpecName(specPath: string): string {
  return specPath.replace("specs/", "").replace(".md", "");
}

/**
 * Convert a spec filename to a readable title.
 * Example: "011-telegram-notifications" -> "Telegram Notifications"
 *
 * @param specName - The spec filename without extension
 * @returns A human-readable title
 */
export function specNameToTitle(specName: string): string {
  // Remove leading numbers (e.g., "011-")
  const withoutNumbers = specName.replace(LEADING_NUMBERS_REGEX, "");
  // Convert kebab-case to Title Case
  return withoutNumbers
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// src/tui/lib/spec-parser.ts
// Pure functions for parsing spec markdown content

/**
 * Parsed spec content with structured sections
 */
export interface ParsedSpec {
  overview: string;
  tasks: string[];
  acceptanceCriteria: string[];
  raw: string;
}

// Section headers we recognize
const SECTION_HEADERS = ["## Overview", "## Tasks", "## Acceptance Criteria"];

// Regex for checkbox lines
const CHECKBOX_REGEX = /^-\s*\[[ x]\]/;
const CHECKBOX_REPLACE_REGEX = /^-\s*\[[ x]\]\s*/;

/**
 * Parse spec markdown content into structured sections.
 * Returns overview, tasks list, acceptance criteria list, and raw content.
 */
export function parseSpecContent(content: string): ParsedSpec {
  const sections = extractSections(content);

  return {
    overview: sections["## Overview"] || "",
    tasks: parseCheckboxList(sections["## Tasks"] || ""),
    acceptanceCriteria: parseCheckboxList(
      sections["## Acceptance Criteria"] || ""
    ),
    raw: content,
  };
}

/**
 * Extract named sections from markdown content.
 * Returns a map of section header -> section content.
 */
function extractSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentHeader = "";
  let currentContent: string[] = [];

  for (const line of content.split("\n")) {
    // Check if this line is a known section header
    const matchingHeader = SECTION_HEADERS.find((h) => line.startsWith(h));

    if (matchingHeader) {
      // Save previous section if any
      if (currentHeader) {
        sections[currentHeader] = currentContent.join("\n").trim();
      }
      currentHeader = matchingHeader;
      currentContent = [];
    } else if (currentHeader) {
      // If we hit another ## header, stop collecting for this section
      if (line.startsWith("## ")) {
        sections[currentHeader] = currentContent.join("\n").trim();
        currentHeader = "";
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
  }

  // Save final section
  if (currentHeader) {
    sections[currentHeader] = currentContent.join("\n").trim();
  }

  return sections;
}

/**
 * Parse a section into a list of checkbox items.
 * Extracts text from lines like "- [ ] Task 1" or "- [x] Task 2"
 */
function parseCheckboxList(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => CHECKBOX_REGEX.test(line))
    .map((line) => line.replace(CHECKBOX_REPLACE_REGEX, "").trim());
}

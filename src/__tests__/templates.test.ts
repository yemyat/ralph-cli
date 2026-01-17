import { describe, expect, it } from "bun:test";
import {
  IMPLEMENTATION_PLAN_TEMPLATE,
  PROMPT_BUILD,
  PROMPT_PLAN,
} from "../templates/prompts";

describe("Template Constants", () => {
  describe("PROMPT_PLAN", () => {
    it("is a non-empty string", () => {
      expect(typeof PROMPT_PLAN).toBe("string");
      expect(PROMPT_PLAN.length).toBeGreaterThan(0);
    });

    it("contains expected sections for planning mode", () => {
      // Should reference specs directory
      expect(PROMPT_PLAN).toContain(".ralph-wiggum/specs");

      // Should reference implementation.json (task-level orchestration)
      expect(PROMPT_PLAN).toContain("implementation.json");

      // Should mention parallel subagents
      expect(PROMPT_PLAN).toContain("subagent");

      // Should emphasize planning only, no implementation
      expect(PROMPT_PLAN).toContain("Plan only");
      expect(PROMPT_PLAN).toContain("do NOT implement");
    });

    it("includes guidance about checking before assuming", () => {
      expect(PROMPT_PLAN).toContain("Do NOT assume");
    });
  });

  describe("PROMPT_BUILD", () => {
    it("is a non-empty string", () => {
      expect(typeof PROMPT_BUILD).toBe("string");
      expect(PROMPT_BUILD.length).toBeGreaterThan(0);
    });

    it("contains expected sections for build mode", () => {
      // Task-level build mode - prompt is simpler since Ralph handles orchestration
      expect(PROMPT_BUILD).toContain("GUARDRAILS.md");

      // Should mention task completion markers
      expect(PROMPT_BUILD).toContain("<TASK_DONE>");
      expect(PROMPT_BUILD).toContain("<TASK_BLOCKED");

      // Should explain that Ralph handles quality gates externally
      expect(PROMPT_BUILD).toContain("Quality gates");

      // Should instruct agent not to commit (Ralph handles this)
      expect(PROMPT_BUILD).toContain("Do NOT commit");
    });
  });

  describe("IMPLEMENTATION_PLAN_TEMPLATE", () => {
    it("is a non-empty string", () => {
      expect(typeof IMPLEMENTATION_PLAN_TEMPLATE).toBe("string");
      expect(IMPLEMENTATION_PLAN_TEMPLATE.length).toBeGreaterThan(0);
    });

    it("contains expected markdown structure", () => {
      // Should have main title
      expect(IMPLEMENTATION_PLAN_TEMPLATE).toContain("# Implementation Plan");

      // Should have workflow state sections
      expect(IMPLEMENTATION_PLAN_TEMPLATE).toContain("## In Progress");
      expect(IMPLEMENTATION_PLAN_TEMPLATE).toContain("## Backlog");
      expect(IMPLEMENTATION_PLAN_TEMPLATE).toContain("## Completed");
    });

    it("uses HTML comments for section guidance", () => {
      // Template uses HTML comments instead of checkboxes
      expect(IMPLEMENTATION_PLAN_TEMPLATE).toContain("<!-- Specs");
    });
  });
});

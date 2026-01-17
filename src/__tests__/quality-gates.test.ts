import { describe, expect, it } from "bun:test";
import { parseQualityGates } from "../utils/quality-gates";

describe("parseQualityGates", () => {
  describe("converts string array to QualityGate[]", () => {
    it("parses basic commands correctly", () => {
      const commands = ["bun run typecheck", "bun run test"];
      const result = parseQualityGates(commands);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "typecheck",
        command: "bun run typecheck",
        required: true,
      });
      expect(result[1]).toEqual({
        name: "test",
        command: "bun run test",
        required: true,
      });
    });

    it("marks all gates as required", () => {
      const commands = ["npm test", "npm run lint", "npm run build"];
      const result = parseQualityGates(commands);

      expect(result.every((gate) => gate.required === true)).toBe(true);
    });
  });

  describe("handles empty array", () => {
    it("returns empty QualityGate[] for empty input", () => {
      const result = parseQualityGates([]);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("gate name extraction for various command formats", () => {
    it("extracts name from npm/yarn/bun script commands", () => {
      const commands = [
        "npm run typecheck",
        "yarn test",
        "bun run lint",
        "pnpm build",
      ];
      const result = parseQualityGates(commands);

      expect(result[0].name).toBe("typecheck");
      expect(result[1].name).toBe("test");
      expect(result[2].name).toBe("lint");
      expect(result[3].name).toBe("build");
    });

    it("extracts name from direct command invocations", () => {
      const commands = ["tsc --noEmit", "eslint .", "vitest"];
      const result = parseQualityGates(commands);

      expect(result[0].name).toBe("--noEmit");
      expect(result[1].name).toBe(".");
      expect(result[2].name).toBe("vitest");
    });

    it("handles single word commands", () => {
      const commands = ["typecheck", "test", "lint"];
      const result = parseQualityGates(commands);

      expect(result[0].name).toBe("typecheck");
      expect(result[1].name).toBe("test");
      expect(result[2].name).toBe("lint");
    });

    it("handles commands with multiple spaces", () => {
      const commands = ["npm   run   test", "bun  run  lint"];
      const result = parseQualityGates(commands);

      expect(result[0].name).toBe("test");
      expect(result[1].name).toBe("lint");
    });

    it("trims whitespace from commands", () => {
      const commands = ["  bun run typecheck  ", "  npm test  "];
      const result = parseQualityGates(commands);

      expect(result[0].command).toBe("bun run typecheck");
      expect(result[0].name).toBe("typecheck");
      expect(result[1].command).toBe("npm test");
      expect(result[1].name).toBe("test");
    });

    it("handles complex commands with flags", () => {
      const commands = [
        "npm run test -- --coverage",
        "vitest run --reporter=verbose",
      ];
      const result = parseQualityGates(commands);

      expect(result[0].name).toBe("--coverage");
      expect(result[1].name).toBe("--reporter=verbose");
    });
  });
});

import { describe, expect, it } from "bun:test";
import { formatBlockedMarker, parseBlockedMarker } from "../constants";

describe("parseBlockedMarker", () => {
  it("extracts reason from valid blocked marker", () => {
    const output = '<TASK_BLOCKED reason="missing API key">';
    const reason = parseBlockedMarker(output);
    expect(reason).toBe("missing API key");
  });

  it("extracts reason when marker is embedded in larger output", () => {
    const output = `Some agent output here
Working on the task...
<TASK_BLOCKED reason="dependency not installed">
More output after`;
    const reason = parseBlockedMarker(output);
    expect(reason).toBe("dependency not installed");
  });

  it("handles reason with special characters", () => {
    const output = '<TASK_BLOCKED reason="DB_HOST env var not set in .env">';
    const reason = parseBlockedMarker(output);
    expect(reason).toBe("DB_HOST env var not set in .env");
  });

  it("handles reason with underscores and numbers", () => {
    const output = '<TASK_BLOCKED reason="API_KEY_123 is invalid">';
    const reason = parseBlockedMarker(output);
    expect(reason).toBe("API_KEY_123 is invalid");
  });

  it("returns null for non-matching input", () => {
    const output = "Task completed successfully";
    const reason = parseBlockedMarker(output);
    expect(reason).toBeNull();
  });

  it("returns null for empty string", () => {
    const reason = parseBlockedMarker("");
    expect(reason).toBeNull();
  });

  it("returns null for TASK_DONE marker", () => {
    const output = "<TASK_DONE>";
    const reason = parseBlockedMarker(output);
    expect(reason).toBeNull();
  });

  it("returns null for malformed blocked marker (missing reason)", () => {
    const output = "<TASK_BLOCKED>";
    const reason = parseBlockedMarker(output);
    expect(reason).toBeNull();
  });

  it("returns null for malformed blocked marker (no quotes)", () => {
    const output = "<TASK_BLOCKED reason=missing quotes>";
    const reason = parseBlockedMarker(output);
    expect(reason).toBeNull();
  });

  it("round-trips with formatBlockedMarker", () => {
    const originalReason = "some blocking reason";
    const formatted = formatBlockedMarker(originalReason);
    const parsed = parseBlockedMarker(formatted);
    expect(parsed).toBe(originalReason);
  });

  it("handles whitespace in marker (regex allows flexible whitespace)", () => {
    const output = '<TASK_BLOCKED  reason="extra space">';
    const reason = parseBlockedMarker(output);
    expect(reason).toBe("extra space");
  });
});

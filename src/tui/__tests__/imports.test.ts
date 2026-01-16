import { describe, expect, test } from "bun:test";
import {
  ConfirmDialog,
  DetailView,
  HelpOverlay,
  LoadingSpinner,
  LogViewer,
  Sidebar,
  SpecViewer,
  TaskDetail,
} from "../components";

describe("component imports", () => {
  test("exports layout components", () => {
    expect(Sidebar).toBeDefined();
    expect(DetailView).toBeDefined();
  });

  test("exports viewer components", () => {
    expect(SpecViewer).toBeDefined();
    expect(LogViewer).toBeDefined();
    expect(TaskDetail).toBeDefined();
  });

  test("exports overlay components", () => {
    expect(HelpOverlay).toBeDefined();
    expect(ConfirmDialog).toBeDefined();
  });

  test("exports primitive components", () => {
    expect(LoadingSpinner).toBeDefined();
  });
});

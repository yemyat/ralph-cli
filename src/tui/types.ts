// src/tui/types.ts
// Centralized type definitions for all TUI components

export type TaskStatus = "backlog" | "in_progress" | "completed" | "stopped";

export interface Task {
  id: string;
  name: string;
  specPath: string;
  status: TaskStatus;
}

export interface ParsedPlan {
  inProgress: Task[];
  backlog: Task[];
  completed: Task[];
  stopped: Task[];
}

export type VimMode = "normal" | "search" | "command";

export type DialogType = "confirm-stop" | "force-kill";

export type FocusedPanel = "spec" | "logs";

export interface ScrollState {
  offset: number;
  maxOffset: number;
  viewportHeight: number;
}

export interface SearchState {
  query: string;
  matches: number[];
  matchIndex: number;
}

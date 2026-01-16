// src/tui/lib/constants.ts
// Centralized theme colors and UI constants

/**
 * Tokyo Night color palette
 * https://github.com/tokyo-night/tokyo-night-vscode-theme
 */
export const TOKYO_NIGHT = {
  // Primary
  blue: "#7aa2f7",
  purple: "#bb9af7",
  cyan: "#7dcfff",

  // Semantic
  green: "#9ece6a", // success, completed
  yellow: "#e0af68", // warning, in-progress
  red: "#f7768e", // error, stopped
  orange: "#ff9e64", // accent

  // Neutral
  fg: "#c0caf5",
  fgDark: "#a9b1d6",
  comment: "#565f89",
  bgHighlight: "#292e42",
  bg: "#1a1b26",
  border: "#414868",
} as const;

export const STATUS_ICONS = {
  backlog: "○",
  in_progress: "●",
  completed: "✓",
  stopped: "■",
} as const;

export const STATUS_COLORS = {
  backlog: TOKYO_NIGHT.fgDark,
  in_progress: TOKYO_NIGHT.yellow,
  completed: TOKYO_NIGHT.green,
  stopped: TOKYO_NIGHT.red,
} as const;

export const TIMING = {
  DOUBLE_TAP_MS: 300,
  POLL_INTERVAL_MS: 2000,
  GRACEFUL_SHUTDOWN_MS: 5000,
  SPINNER_FRAME_MS: 80,
} as const;

export const LAYOUT = {
  SIDEBAR_WIDTH: 30,
  HEADER_HEIGHT: 2,
  FOOTER_HEIGHT: 2,
  MIN_CONTENT_HEIGHT: 10,
} as const;

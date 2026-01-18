---
name: ralph-wiggum
description: Use the Ralph Wiggum CLI for autonomous AI coding loops. Use when running ralph commands, setting up autonomous coding workflows, or managing AI agent loops for planning and building features.
---

# Ralph CLI

Ralph runs AI agents (Claude Code, Amp, Droid, OpenCode, Cursor, Codex, Gemini) in continuous loops until tasks are complete. Build mode uses task-level orchestration — each task is executed individually with quality gates run after completion.

## Installation

```bash
bun install -g ralph-wiggum-cli
```

Or with npm:

```bash
npm install -g ralph-wiggum-cli
```

## Core Commands

```bash
ralph-wiggum-cli                         # Launch interactive TUI
ralph-wiggum-cli init                    # Initialize project (creates .ralph-wiggum/ directory)
ralph-wiggum-cli reinit                  # Reinitialize prompts (updates PROMPT_plan.md and example spec)
ralph-wiggum-cli start plan              # Start planning loop - analyzes specs, creates implementation.json
ralph-wiggum-cli start build             # Start build loop - implements tasks one at a time
ralph-wiggum-cli stop                    # Stop running session
ralph-wiggum-cli status                  # Check current session status
ralph-wiggum-cli logs -f                 # Follow logs in real-time
ralph-wiggum-cli agents                  # List available AI agents and installation status
```

## Project Structure

After `ralph-wiggum-cli init`, a `.ralph-wiggum/` directory is created:

```
.ralph-wiggum/
├── config.json              # Project config (agents, notifications, sessions)
├── PROMPT_plan.md           # Instructions for planning mode
├── GUARDRAILS.md            # Compliance rules (before/after checks)
├── PROGRESS.md              # Audit trail of completed work
├── implementation.json      # Structured task list (JSON format)
├── specs/                   # Specification files you write
└── logs/                    # Session logs (gitignored)
```

Note: `PROMPT_build.md` no longer exists — build prompts are dynamically injected per task.

## Workflow

1. Write specifications in `.ralph-wiggum/specs/` describing what to build
2. Run `ralph-wiggum-cli start plan` to analyze specs and generate `implementation.json`
3. Run `ralph-wiggum-cli start build` to implement tasks one at a time
4. Plan mode exits when AI outputs `<STATUS>DONE</STATUS>`
5. Build mode runs each task, then quality gates, committing after each task completes

## Command Options

```bash
# Init with different agents for plan vs build
ralph-wiggum-cli init -a <agent>              # Set agent for both modes
ralph-wiggum-cli init --plan-agent claude --build-agent droid
ralph-wiggum-cli init --plan-model opus --build-model sonnet
ralph-wiggum-cli init -f                      # Force reinitialization

# Start options
ralph-wiggum-cli start build -v               # Verbose output
ralph-wiggum-cli start build -n 5             # Max 5 iterations
ralph-wiggum-cli start build -a droid         # Override agent for this session
ralph-wiggum-cli start build -m <model>       # Override model for this session

# Logs options
ralph-wiggum-cli logs -s <session-id>         # View specific session
ralph-wiggum-cli logs -n 100                  # Show last 100 lines
ralph-wiggum-cli logs -f                      # Follow log output
```

## Supported Agents

- **claude**: Claude Code (`claude` CLI)
- **amp**: Amp Code (`amp` CLI)
- **droid**: Factory Droid (`droid` CLI)
- **opencode**: OpenCode (`opencode` CLI)
- **cursor**: Cursor Agent (`agent` CLI)
- **codex**: OpenAI Codex (`codex` CLI)
- **gemini**: Gemini CLI (`gemini` CLI)

## Completion Signals

**Plan mode:** Exits when AI outputs `<STATUS>DONE</STATUS>`

**Build mode (task-level):**

- `<TASK_DONE>` — task completed successfully
- `<TASK_BLOCKED reason="...">` — task is blocked (will retry or skip)

The loop also stops when:

- User presses Ctrl+C
- Max iterations reached (if `-n` flag used)

## Notifications

Ralph supports Telegram notifications for iteration completion. Configure in `.ralph-wiggum/config.json`:

```json
{
  "notifications": {
    "telegram": {
      "enabled": true,
      "botToken": "your-bot-token",
      "chatId": "your-chat-id"
    }
  }
}
```

# AGENTS.md

Agent guidance for the Ralph CLI project.

## Project Overview

Ralph CLI is a command-line tool for managing AI development workflows using the "Ralph Wiggum" technique - autonomous coding loops with AI agents.

## Build & Test Commands

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Type check
bun run typecheck

# Link globally for testing
bun link
```

## Code Conventions

- TypeScript with strict mode
- ES modules (`"type": "module"`)
- Use `bun` runtime (not Node.js)
- Minimal comments, self-documenting code
- No `.js` extensions in imports (Bun + `moduleResolution: "bundler"` handles this)

## Architecture Overview

The codebase follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI (index.ts)                       │
│              Command parsing via Commander              │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Commands Layer                        │
│     init.ts, plan.ts, build.ts, status.ts, stop.ts     │
│         Thin wrappers that delegate to services         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Services Layer                        │
│  Planner, Builder, AgentRunner, HookDispatcher, etc.   │
│        Business logic and orchestration                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    Domain Layer                         │
│   Workspace, Session, Implementation, Spec, Task       │
│           Core data models with behavior                │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Agents Layer                          │
│       BaseAgent + implementations (claude, amp, etc.)   │
│            AI agent command builders                    │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── index.ts              # CLI entry point (commander setup)
├── types.ts              # TypeScript type definitions
├── constants.ts          # Markers, file names, defaults
│
├── commands/             # CLI command handlers (thin wrappers)
│   ├── init.ts           # ralph-wiggum-cli init
│   ├── plan.ts           # ralph-wiggum-cli plan
│   ├── build.ts          # ralph-wiggum-cli build
│   ├── status.ts         # ralph-wiggum-cli status
│   └── stop.ts           # ralph-wiggum-cli stop
│
├── services/             # Business logic and orchestration
│   ├── planner.ts        # Plan mode orchestration
│   ├── builder.ts        # Build mode orchestration (task loop)
│   ├── agent-runner.ts   # Spawns agent process, parses output
│   ├── hook-dispatcher.ts# Event system for listeners
│   ├── console-listener.ts # Console output for hook events
│   ├── notification-service.ts # Telegram notifications
│   └── logger-service.ts # Per-session/task file logging
│
├── domain/               # Core data models with behavior
│   ├── workspace.ts      # Project config, session manager
│   ├── session.ts        # Single run session (plan or build)
│   ├── session-manager.ts# Session CRUD operations
│   ├── implementation.ts # implementation.json wrapper
│   ├── spec.ts           # Spec entry with tasks
│   └── task.ts           # Individual task with status
│
├── agents/               # AI agent implementations
│   ├── base.ts           # Abstract BaseAgent class
│   ├── claude.ts         # Claude Code agent
│   ├── amp.ts            # Amp Code agent
│   ├── droid.ts          # Factory Droid agent
│   ├── pi.ts             # Pi agent
│   ├── opencode.ts       # OpenCode agent
│   ├── cursor.ts         # Cursor agent
│   ├── codex.ts          # Codex agent
│   ├── gemini.ts         # Gemini CLI agent
│   └── index.ts          # Agent registry
│
├── templates/            # Prompt templates
│   └── prompts.ts        # PROMPT_PLAN, PROMPT_BUILD, etc.
│
└── utils/
    ├── paths.ts          # Path utilities (.ralph-wiggum/ dirs)
    └── telegram.ts       # Telegram API client
```

## Key Concepts

### Domain Models

- **Workspace**: Root model representing an initialized project. Loads/saves `config.json`, manages sessions.
- **Session**: A single execution run (plan or build mode). Tracks status, iteration count, PID.
- **Implementation**: Wraps `implementation.json`. Contains specs and provides `nextPendingTask`.
- **Spec**: A specification with tasks. Tracks completion status.
- **Task**: Individual unit of work. Has status (pending, in_progress, completed, blocked, failed).

### Services

- **Planner**: Orchestrates plan mode. Validates state, runs agent with plan prompt, handles signals.
- **Builder**: Orchestrates build mode. Loops through tasks, generates per-task prompts, tracks progress.
- **AgentRunner**: Spawns agent subprocess, pipes prompt via stdin, parses output for completion markers.
- **HookDispatcher**: Event bus. Emits events like `onLoopStarted`, `onIterationSuccess`, `onTaskBlocked`.
- **ConsoleListener**: Prints formatted output to console for hook events.
- **TelegramListener**: Sends notifications for hook events.
- **LoggerService**: Creates timestamped log files per session/task.

### Hook Events

```typescript
interface HookListener {
  onLoopStarted?(payload): void;
  onIterationStarted?(payload): void;
  onIterationSuccess?(payload): void;
  onIterationFailure?(payload): void;
  onTaskBlocked?(payload): void;
  onSpecCompleted?(payload): void;
  onLoopCompleted?(payload): void;
  onLoopStopped?(payload): void;
}
```

### Task Completion Markers

Agents signal completion via stdout:

- `<TASK_DONE>` - Task completed successfully
- `<TASK_BLOCKED reason="...">` - Task blocked

## Supported AI Agents

### Claude Code (Anthropic)

```bash
claude -p --dangerously-skip-permissions --output-format=stream-json --model <model>

# Models: sonnet, opus, or full model names
# Docs: https://docs.anthropic.com/en/docs/claude-code/cli-reference
```

### Amp Code (Sourcegraph)

```bash
amp --execute --stream-json --mode <smart|rush>

# Modes: smart (full power), rush (faster/cheaper)
# Docs: https://ampcode.com/manual
```

### Factory Droid

```bash
droid exec --auto high -o stream-json -m <model>

# Autonomy levels: low, medium, high
# Docs: https://docs.factory.ai/reference/cli-reference
```

### Pi

```bash
pi --print --mode json --thinking high --model <model> --provider <provider>

# Docs: https://github.com/mariozechner/pi-coding-agent
```

### Gemini CLI

```bash
gemini -p --auto

# Docs: https://ai.google.dev/gemini-api
```

## Adding a New Agent

1. Create `src/agents/<name>.ts` extending `BaseAgent`
2. Implement `buildCommand()`, `checkInstalled()`, `getInstallInstructions()`
3. Register in `src/agents/index.ts`
4. Add to `AgentType` union in `src/types.ts`

Example:

```typescript
// src/agents/myagent.ts
import { BaseAgent } from "./base";
import type { AgentCommand, AgentOptions } from "../types";

export class MyAgentAgent extends BaseAgent {
  type = "myagent" as const;
  name = "My Agent";

  buildCommand(options: AgentOptions): AgentCommand {
    const args = ["--auto", "--json"];
    if (options.model) args.push("--model", options.model);
    return { command: "myagent", args };
  }

  async checkInstalled(): Promise<boolean> {
    try {
      await Bun.$`which myagent`.quiet();
      return true;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return "npm install -g myagent";
  }
}
```

## Project Directory Structure

All Ralph data is stored in the project's `.ralph-wiggum/` folder:

```
.ralph-wiggum/
├── config.json          # Project config and session history
├── PROMPT_plan.md       # Planning mode prompt (customizable)
├── implementation.json  # Structured task tracking (generated by plan)
├── GUARDRAILS.md        # Compliance rules (before/after checks)
├── PROGRESS.md          # Audit trail (what was done)
├── specs/               # Specs with tasks + acceptance criteria
│   └── example.md       # Example spec template
└── logs/                # Session logs (gitignored)
```

## When You Are Writing Specs

Always ask me questions so that you can strengthen your understanding of my requirements and ensure that the specifications are clear and accurate.

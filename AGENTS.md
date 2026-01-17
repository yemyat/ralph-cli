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

## Project Structure

```
src/
├── index.ts          # CLI entry point (commander setup)
├── types.ts          # TypeScript type definitions
├── config.ts         # Configuration management (.ralph-wiggum/)
├── agents/           # Agent implementations
│   ├── base.ts       # Abstract base agent class
│   ├── claude.ts     # Claude Code agent
│   ├── amp.ts        # Amp Code agent
│   ├── droid.ts      # Factory Droid agent
│   └── index.ts      # Agent registry
├── commands/         # CLI command implementations
│   ├── init.ts       # ralph-wiggum-cli init
│   ├── start.ts      # ralph-wiggum-cli start [plan|build]
│   ├── stop.ts       # ralph-wiggum-cli stop
│   ├── status.ts     # ralph-wiggum-cli status
│   ├── list.ts       # ralph-wiggum-cli list
│   └── logs.ts       # ralph-wiggum-cli logs
├── templates/        # Prompt templates
│   └── prompts.ts    # PROMPT_plan.md, PROMPT_build.md templates
└── utils/
    └── paths.ts      # Path utilities (.ralph-wiggum/ project dir)
```

## Supported AI Agents

### Claude Code (Anthropic)

```bash
# CLI command format
claude -p --dangerously-skip-permissions --output-format=stream-json --model <model>

# Models: sonnet, opus, or full model names
# Docs: https://docs.anthropic.com/en/docs/claude-code/cli-reference
```

### Amp Code (Sourcegraph)

```bash
# CLI command format
amp --execute --stream-json --mode <smart|rush>

# Modes: smart (full power), rush (faster/cheaper)
# Docs: https://ampcode.com/manual
```

### Factory Droid

```bash
# CLI command format (--auto and --skip-permissions-unsafe are mutually exclusive)
droid exec --auto high -o stream-json -m <model>

# Autonomy levels: low, medium, high
# Docs: https://docs.factory.ai/reference/cli-reference
```

## Adding a New Agent

1. Create `src/agents/<name>.ts` extending `BaseAgent`
2. Implement `buildCommand()`, `checkInstalled()`, `getInstallInstructions()`
3. Register in `src/agents/index.ts`
4. Add to `AgentType` union in `src/types.ts`

## Project Directory Structure

All Ralph data is stored in the project's `.ralph-wiggum/` folder:

```
.ralph-wiggum/
├── config.json            # Project config and session history
├── PROMPT_plan.md         # Planning mode prompt
├── PROMPT_build.md        # Building mode prompt
├── GUARDRAILS.md          # Compliance rules (before/after checks)
├── IMPLEMENTATION_PLAN.md # Progress orchestrator (which specs are done)
├── PROGRESS.md            # Audit trail (what happened)
├── specs/                 # Specs with tasks + acceptance criteria
└── logs/                  # Session logs (gitignored)
```

## When you are writing specs

Always ask me questions so that you can strengthen your understanding of my requirements and ensure that the specifications are clear and accurate.

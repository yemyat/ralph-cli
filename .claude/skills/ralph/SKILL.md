---
name: ralph-wiggum-cli
description: Use the Ralph Wiggum CLI for autonomous AI coding loops. Use when running ralph-wiggum-cli commands, setting up autonomous coding workflows, or managing AI agent loops for planning and building features.
---

# Ralph CLI

Ralph runs AI agents (Claude Code, Amp, Droid, OpenCode, Cursor, Codex, Gemini) in continuous loops until tasks are complete.

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
ralph-wiggum-cli init                    # Initialize project (creates .ralph/ directory)
ralph-wiggum-cli start plan              # Start planning loop - analyzes specs, creates implementation plan
ralph-wiggum-cli start build             # Start build loop - implements features autonomously
ralph-wiggum-cli stop                    # Stop running session
ralph-wiggum-cli status                  # Check current session status
ralph-wiggum-cli logs -f                 # Follow logs in real-time
```

## Project Structure

After `ralph-wiggum-cli init`, a `.ralph/` directory is created:

```
.ralph/
├── PROMPT_plan.md           # Instructions for planning mode
├── PROMPT_build.md          # Instructions for build mode
├── IMPLEMENTATION_PLAN.md   # Task list maintained by the AI
└── specs/                   # Specification files you write
```

## Workflow

1. Write specifications in `.ralph/specs/` describing what to build
2. Run `ralph-wiggum-cli start plan` to analyze specs and generate implementation plan
3. Run `ralph-wiggum-cli start build` to implement features autonomously
4. The loop exits automatically when AI outputs `<STATUS>DONE</STATUS>`

## Command Options

```bash
ralph-wiggum-cli init -a <agent>             # Choose agent (claude, amp, droid, opencode, cursor, codex, gemini)
ralph-wiggum-cli init -m <model>             # Specify model
ralph-wiggum-cli start build -v              # Verbose output
ralph-wiggum-cli start build -n 5            # Max 5 iterations
ralph-wiggum-cli start build -a droid        # Override agent for this session
```

## Supported Agents

- **claude**: Claude Code (`claude` CLI)
- **amp**: Amp Code (`amp` CLI)
- **droid**: Factory Droid (`droid` CLI)
- **opencode**: OpenCode (`opencode` CLI)
- **cursor**: Cursor Agent (`agent` CLI)
- **codex**: OpenAI Codex (`codex` CLI)
- **gemini**: Gemini CLI (`gemini` CLI)

## Completion

The loop stops when:
- AI outputs `<STATUS>DONE</STATUS>` (all tasks complete)
- User presses Ctrl+C
- Max iterations reached (if `-n` flag used)

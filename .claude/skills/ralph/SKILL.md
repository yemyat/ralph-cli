---
name: ralph
description: Use the Ralph CLI for autonomous AI coding loops. Use when running ralph commands, setting up autonomous coding workflows, or managing AI agent loops for planning and building features.
---

# Ralph CLI

Ralph runs AI agents (Claude Code, Amp, Droid) in continuous loops until tasks are complete.

## Core Commands

```bash
ralph init                    # Initialize project (creates .ralph/ directory)
ralph start plan              # Start planning loop - analyzes specs, creates implementation plan
ralph start build             # Start build loop - implements features autonomously
ralph stop                    # Stop running session
ralph status                  # Check current session status
ralph logs -f                 # Follow logs in real-time
```

## Project Structure

After `ralph init`, a `.ralph/` directory is created:

```
.ralph/
├── PROMPT_plan.md           # Instructions for planning mode
├── PROMPT_build.md          # Instructions for build mode
├── IMPLEMENTATION_PLAN.md   # Task list maintained by the AI
└── specs/                   # Specification files you write
```

## Workflow

1. Write specifications in `.ralph/specs/` describing what to build
2. Run `ralph start plan` to analyze specs and generate implementation plan
3. Run `ralph start build` to implement features autonomously
4. The loop exits automatically when AI outputs `<STATUS>DONE</STATUS>`

## Command Options

```bash
ralph init -a claude|amp|droid    # Choose agent
ralph init -m <model>             # Specify model
ralph start build -v              # Verbose output
ralph start build -n 5            # Max 5 iterations
ralph start build -a droid        # Override agent for this session
```

## Supported Agents

- **claude**: Claude Code (`claude` CLI)
- **amp**: Amp Code (`amp` CLI)
- **droid**: Factory Droid (`droid` CLI)

## Completion

The loop stops when:
- AI outputs `<STATUS>DONE</STATUS>` (all tasks complete)
- User presses Ctrl+C
- Max iterations reached (if `-n` flag used)

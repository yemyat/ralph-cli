# Ralph CLI

A command-line tool for managing **Ralph Wiggum** AI development workflows across projects.

Based on the [Ralph Wiggum Technique](https://github.com/ghuntley/how-to-ralph-wiggum) - an AI development methodology that uses autonomous coding loops with AI agents.

> **Meta**: This CLI was built by pointing an AI agent at the [Ralph Wiggum technique repo](https://github.com/ghuntley/how-to-ralph-wiggum), then using Ralph itself to implement and refine the tool. Recursive AI development in action.

## Installation

```bash
bun install -g ralph-wiggum-cli
```

Or with npm:

```bash
npm install -g ralph-wiggum-cli
```

For local development:

```bash
git clone <repo>
cd ralph-cli
bun install
bun link
```

## AI Agent Skills

Ralph includes a skill file that teaches AI agents how to use the CLI.

### Claude Code

```bash
cp -r .claude/skills/ralph ~/.claude/skills/
```

## Quick Start

```bash
# Initialize Ralph in your project
cd your-project
ralph-wiggum-cli init

# Start planning mode (generates IMPLEMENTATION_PLAN.md)
ralph-wiggum-cli start plan

# Start building mode (implements from plan)
ralph-wiggum-cli start build

# View status
ralph-wiggum-cli status

# Stop the loop
ralph-wiggum-cli stop
```

## Commands

| Command                                | Description                             |
| -------------------------------------- | --------------------------------------- |
| `ralph-wiggum-cli init`                | Initialize Ralph in the current project |
| `ralph-wiggum-cli start [plan\|build]` | Start the Ralph loop                    |
| `ralph-wiggum-cli stop`                | Stop the running Ralph session          |
| `ralph-wiggum-cli status`              | Show project status and sessions        |
| `ralph-wiggum-cli list`                | List all Ralph projects                 |
| `ralph-wiggum-cli logs`                | View session logs                       |
| `ralph-wiggum-cli agents`              | List available AI agents                |

## Options

### Global Options

- `--agent <claude|amp|droid>` - Switch between AI agents
- `--model <model>` - Specify the model to use

### Start Options

- `-n, --max-iterations <n>` - Maximum number of iterations
- `-v, --verbose` - Enable verbose output

## Supported Agents

| Agent    | Description                                         |
| -------- | --------------------------------------------------- |
| `claude` | [Claude Code](https://code.claude.com) by Anthropic |
| `amp`    | [Amp Code](https://ampcode.com) by Sourcegraph      |
| `droid`  | [Factory Droid](https://factory.ai) CLI             |

## Project Structure

After `ralph-wiggum-cli init`, your project will have:

```
your-project/
└── .ralph/
    ├── PROMPT_plan.md         # Planning mode prompt
    ├── PROMPT_build.md        # Building mode prompt
    ├── IMPLEMENTATION_PLAN.md # Auto-generated implementation plan
    └── specs/                 # Specification files
        └── example.md
```

## Configuration

Ralph stores configuration in `~/.ralph/`:

- `config.json` - Global configuration and project registry
- `projects/` - Per-project configuration
- `logs/` - Session logs

## How It Works

Ralph implements the "Ralph Wiggum" technique:

1. **Planning Phase**: AI analyzes specs and generates an implementation plan
2. **Building Phase**: AI iterates through the plan, implementing one task per loop
3. **Loop Mechanics**: Fresh context each iteration, backpressure via tests/builds
4. **Git Integration**: Commits after each successful iteration

Each iteration:

1. Reads specs and current plan
2. Selects the most important task
3. Implements the task
4. Runs tests (backpressure)
5. Commits changes
6. Pushes to remote

## License

MIT

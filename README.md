# Ralph CLI

A command-line tool for managing **Ralph Wiggum** AI development workflows across projects.

Based on the [Ralph Wiggum Technique](https://github.com/ghuntley/how-to-ralph-wiggum) - an AI development methodology that uses autonomous coding loops with AI agents.

## Installation

```bash
bun install -g ralph-cli
```

Or clone and link locally:

```bash
git clone <repo>
cd ralph-cli
bun install
bun link
```

## Quick Start

```bash
# Initialize Ralph in your project
cd your-project
ralph init

# Start planning mode (generates IMPLEMENTATION_PLAN.md)
ralph start plan

# Start building mode (implements from plan)
ralph start build

# View status
ralph status

# Stop the loop
ralph stop
```

## Commands

| Command | Description |
|---------|-------------|
| `ralph init` | Initialize Ralph in the current project |
| `ralph start [plan\|build]` | Start the Ralph loop |
| `ralph stop` | Stop the running Ralph session |
| `ralph status` | Show project status and sessions |
| `ralph list` | List all Ralph projects |
| `ralph logs` | View session logs |
| `ralph agents` | List available AI agents |

## Options

### Global Options

- `--agent <claude|amp|droid>` - Switch between AI agents
- `--model <model>` - Specify the model to use

### Start Options

- `-n, --max-iterations <n>` - Maximum number of iterations
- `-v, --verbose` - Enable verbose output

## Supported Agents

| Agent | Description |
|-------|-------------|
| `claude` | [Claude Code](https://code.claude.com) by Anthropic |
| `amp` | [Amp Code](https://ampcode.com) by Sourcegraph |
| `droid` | [Factory Droid](https://factory.ai) CLI |

## Project Structure

After `ralph init`, your project will have:

```
your-project/
└── .ralph/
    ├── AGENTS.md              # Agent configuration and project guidance
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

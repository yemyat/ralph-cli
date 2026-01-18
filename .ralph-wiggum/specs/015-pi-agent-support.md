# PI Agent Support

## Problem to solve
As a Ralph CLI user, I want to use PI coding agent for autonomous coding loops, so I can leverage PI's capabilities (thinking levels, multi-provider support) within Ralph workflows.

## Intended users
- Developers using Ralph CLI who prefer PI as their AI coding agent
- Users who want to use PI's extended thinking capabilities (`--thinking high`)

## User experience goal
The user should be able to configure Ralph to use PI agent for plan and/or build modes, with optional model override, and have Ralph execute PI in non-interactive JSON mode with high thinking level.

## Proposal
Add a new `PiAgent` class that:
1. Extends `BaseAgent` 
2. Builds commands using PI's CLI flags:
   - `--print` (non-interactive mode)
   - `--mode json` (structured JSON output)
   - `--thinking high` (always enabled for quality)
   - `--model <model>` (optional user override)
   - `--provider <provider>` (optional user override)
3. Checks if `pi` is installed
4. Provides installation instructions

### Command format
```bash
pi --print --mode json --thinking high [--provider <provider>] [--model <model>]
```

## Tasks
- [ ] Add `provider?: string` to `AgentOptions` interface in `src/agents/base.ts`
- [ ] Create `src/agents/pi.ts` implementing `PiAgent` class
- [ ] Add `"pi"` to `AgentType` union in `src/types.ts`
- [ ] Register `PiAgent` in `src/agents/index.ts`
- [ ] Update AGENTS.md documentation with PI agent details

## Acceptance Criteria
- [ ] Given PI is installed, when user runs `ralph start plan --agent pi`, then Ralph executes PI with `--print --mode json --thinking high` flags
- [ ] Given user specifies `--model claude-sonnet`, when Ralph starts PI agent, then the command includes `--model claude-sonnet`
- [ ] Given user specifies `--provider anthropic`, when Ralph starts PI agent, then the command includes `--provider anthropic`
- [ ] Given user specifies both `--provider openai --model gpt-4o`, when Ralph starts PI agent, then both flags are included
- [ ] Given PI is not installed, when user tries to use PI agent, then Ralph shows installation instructions
- [ ] Given no model/provider is specified, when Ralph starts PI agent, then PI uses its defaults (google/gemini-2.5-flash)

## Success Metrics
- PI agent can be selected and runs successfully in plan/build modes
- JSON output is properly parsed by Ralph's streaming handler
- Thinking level is always set to high for consistent quality

## Testing Requirements
- [ ] Manual test: `ralph init` with pi agent
- [ ] Manual test: `ralph start plan` with pi agent
- [ ] Manual test: `ralph start build` with pi agent
- [ ] Verify JSON output streaming works

## Notes
### PI CLI Reference
```
pi --print --mode json --thinking high [--provider <provider>] [--model <model>]
```

### Key flags:
- `--print` / `-p`: Non-interactive mode (process prompt and exit)
- `--mode json`: Structured JSON output for parsing
- `--thinking high`: Extended thinking (always forced for quality)
- `--provider <name>`: Override provider (optional, default: google)
- `--model <id>`: Override model (optional, default: gemini-2.5-flash)

### Environment variables:
- `ANTHROPIC_API_KEY` - For Claude models
- `OPENAI_API_KEY` - For GPT models  
- `GEMINI_API_KEY` - For Gemini models (default)
- Many more providers supported

### Installation:
```bash
bun install -g @anthropic/pi-coding-agent
# or
npm install -g @anthropic/pi-coding-agent
```

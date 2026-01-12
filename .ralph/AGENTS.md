# AGENTS.md

This file contains operational guidance for the AI agents working on this project.

## Project Overview
Ralph CLI is a command-line tool for managing AI development workflows using autonomous coding loops with AI agents. It supports Claude Code, Amp Code, and Factory Droid.

## Build & Test Commands
```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun test

# Build for distribution
bun run build
```

## Code Conventions
- TypeScript with strict mode
- ES modules (`"type": "module"`)
- Use `bun` runtime (not Node.js)
- Minimal comments, self-documenting code
- Test files go in `src/__tests__/` with `.test.ts` extension

## Important Notes
- Always run `bun run typecheck` and `bun test` before committing
- Keep commits atomic and well-described
- Use temp directories for filesystem tests to avoid side effects

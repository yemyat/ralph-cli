# Contributing to Ralph CLI

Thanks for your interest in contributing!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/yemyat/ralph-cli.git
cd ralph-cli

# Install dependencies
bun install

# Run in development mode
bun run dev

# Link globally for testing
bun link
```

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commits must follow this format:

```
<type>: <description>
```

**Types:**
- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `chore:` - Maintenance, refactoring, dependencies

**Breaking changes:** Add `!` after type (e.g., `feat!:`) or include `BREAKING CHANGE:` in the commit body. This triggers a major version bump.

Commits are enforced via commitlint + husky.

## Pull Request Process

1. Fork the repo and create your branch from `dev`
2. Make your changes
3. Ensure all checks pass: `bun run lint && bun run typecheck`
4. Submit a PR to `dev` branch
5. PRs are squash-merged to keep history clean

## Code Style

- TypeScript with strict mode
- Use `bun` runtime
- Minimal comments, prefer self-documenting code
- Follow existing patterns in the codebase

## Adding a New AI Agent

See [AGENTS.md](./AGENTS.md#adding-a-new-agent) for instructions.

## Releases

Releases are automated via semantic-release. When PRs are merged to `main`:
- Version is auto-bumped based on commit types
- CHANGELOG.md is updated
- Package is published to npm
- GitHub release is created

## Questions?

Open an issue or start a discussion.

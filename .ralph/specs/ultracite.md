# Ultracite Integration Specification

## Overview
Integrate Ultracite with Biome toolchain for zero-config linting and formatting to improve code quality and consistency.

## Requirements

### Installation
- [ ] Install Ultracite with Biome: `npx ultracite init --linter biome --pm bun --quiet`
- [ ] Verify biome.json is created
- [ ] Verify package.json has ultracite dependency

### Package.json Scripts
- [ ] Add `lint` script: `ultracite check`
- [ ] Add `lint:fix` script: `ultracite fix`
- [ ] Add `format` script: `ultracite fix` (alias for consistency)

### Code Fixes
- [ ] Run `ultracite fix` to auto-fix all fixable issues
- [ ] Manually fix any remaining lint errors
- [ ] Ensure all source files pass lint checks

### Verification
- [ ] `bun run lint` passes with no errors
- [ ] `bun run typecheck` still passes
- [ ] `bun test` still passes (all 52 tests)

## Technical Notes
- Ultracite docs: https://docs.ultracite.ai/
- Using Biome toolchain (Rust-based, fast)
- Zero-config by design - minimal setup required

## Acceptance Criteria
- All lint checks pass
- All existing tests pass
- Code is consistently formatted
- No breaking changes to functionality

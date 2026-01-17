# Telegram Notifications on Iteration Completion

## Problem to solve
As a developer running long Ralph loops, I want to receive Telegram notifications when iterations complete, so I can monitor progress without watching the terminal.

## Intended users
- Developers running Ralph in plan or build mode who want async notifications
- Teams monitoring autonomous coding loops remotely

## User experience goal
The user should be able to configure Telegram credentials once during `ralph init` and automatically receive notifications when each iteration completes.

## Proposal

### Configuration (in `config.json`)
Add optional `notifications` block to `RalphConfig`:

```typescript
notifications?: {
  telegram?: {
    botToken: string;
    chatId: string;
    enabled: boolean;
  };
};
```

### Init Flow
During `ralph init`, prompt user:
1. "Enable Telegram notifications? (y/N)"
2. If yes, ask for bot token and chat ID
3. Store in config.json

### Notification Triggers
Send notifications on:
1. **Iteration success**: "✓ [project] Iteration X completed (mode)"
2. **Iteration failure**: "✗ [project] Iteration X failed (mode)"  
3. **Loop completed**: "🎉 [project] Loop finished after X iterations (mode)"
4. **Loop stopped**: "⏹ [project] Loop stopped by user after X iterations"

### Message Content
Parse `IMPLEMENTATION_PLAN.md` to extract the current spec from "In Progress" section. Include:
- Project name
- Mode (plan/build)
- Session ID
- Iteration number
- **Current spec being worked on** (from IMPLEMENTATION_PLAN.md "In Progress")
- Status (success/failure/done/stopped)

### Message Format
```
[Ralph] project-name
Mode: build
Session: abc123
Iteration: 5 ✓

Spec: 011-telegram-notifications
Status: Completed
```

For plan mode (no spec context):
```
[Ralph] project-name
Mode: plan
Session: abc123
Iteration: 3 ✓

Status: Completed
```

## Tasks
- [x] Add `TelegramConfig` type to `src/types.ts`
- [x] Add `notifications` field to `RalphConfig` interface
- [x] Create `src/utils/telegram.ts` with `sendTelegramNotification()` function
- [x] Create `src/utils/plan-parser.ts` to extract current spec from IMPLEMENTATION_PLAN.md
- [x] Update `src/commands/init.ts` to prompt for Telegram config
- [x] Update `src/commands/start.ts` to send notifications after iterations (include current spec in build mode)
- [x] Handle notification failures gracefully (log warning, don't crash loop)

## Acceptance Criteria
- [x] Given Telegram is configured, when an iteration completes successfully, then a success notification is sent
- [x] Given Telegram is configured, when an iteration fails, then a failure notification is sent
- [x] Given Telegram is configured, when the loop completes (DONE marker), then a completion notification is sent
- [x] Given Telegram is NOT configured, when an iteration completes, then no notification is attempted
- [x] Given Telegram API fails, when sending notification, then the loop continues (notification failure is non-blocking)

## Success Metrics
- Notifications arrive within 5 seconds of iteration completion
- Zero loop crashes due to notification failures

## Testing Requirements
- [x] Unit test: `sendTelegramNotification()` with mocked fetch
- [x] Unit test: graceful handling of network errors
- [x] Integration test: init flow with Telegram prompts

## Notes
- Use Telegram Bot API: `https://api.telegram.org/bot<token>/sendMessage`
- Bot token format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
- Chat ID can be obtained via `@userinfobot` or API
- Consider rate limiting if iterations are very fast (Telegram allows ~30 msg/sec)

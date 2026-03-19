## Why

The QA system currently supports OpenAI API calls and has a basic CLI stub. Need proper Codex CLI integration that spawns the local `codex` command, passes the prompt via stdin/arguments, and critically inherits all environment variables from the server process. The host machine has multiple codex instances configured via environment variables, so env inheritance is essential for correct routing.

## What Changes

- Improve `callCLI` in qa_service.ts to properly handle codex CLI:
  - Inherit full `process.env` when spawning (Bun.spawn does this by default, but make it explicit)
  - Support optional `codex_path` in model config to specify a custom codex binary path
  - Use `codex -q` (quiet mode, single prompt, no interactive) for single-shot Q&A
  - Handle long prompts via stdin pipe instead of command-line argument (avoid arg length limits)
  - Add proper timeout handling for CLI calls
- Add a codex model entry example in config.yml
- Also improve claude_cli support with the same patterns

## Capabilities

### New Capabilities
- `codex-cli-qa`: Proper Codex CLI integration for Q&A — spawn local codex with full env inheritance, stdin prompt piping, timeout, and configurable binary path

### Modified Capabilities
(none)

## Impact

- **Modified**: `packages/backend/src/services/qa_service.ts` (improve callCLI)
- **Modified**: `config.yml` (add codex model example)
- No new dependencies

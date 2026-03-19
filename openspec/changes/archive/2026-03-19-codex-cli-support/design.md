## Context

The existing `callCLI` function uses `Bun.spawn([cmd, '-p', prompt])` which has issues: long prompts may exceed arg length limits, and the codex CLI flags may differ from claude CLI.

## Goals / Non-Goals

**Goals:**
- Codex CLI: pipe prompt via stdin, inherit env, configurable timeout and binary path
- Claude CLI: same improvements
- Environment variables fully inherited (critical for multi-codex setups)

**Non-Goals:**
- Interactive/multi-turn conversations with CLI
- Streaming output

## Decisions

### 1. Pipe prompt via stdin
Write the full prompt to the subprocess stdin then close it. This avoids command-line argument length limits which are typically 128KB-2MB depending on OS.

### 2. Explicit env inheritance
Pass `env: process.env` to `Bun.spawn()`. While Bun inherits env by default, being explicit makes the behavior clear and ensures any custom env vars (CODEX_HOME, API keys, etc.) are passed through.

### 3. Configurable binary path and timeout
Model config supports `cli_path` (custom binary location) and `timeout` (ms, default 120000). This handles cases where codex is installed in a non-standard location.

### 4. Codex uses `-q` flag for quiet single-shot mode
`codex -q "prompt"` runs a single prompt and exits. For long prompts, pipe via stdin: `echo "prompt" | codex -q`.

## Context

Probes against Codex 0.162.1 app-server (ephemeral thread, `sandbox: read-only`, `approvalPolicy: never`):
- `image_gen` works; the `imageGeneration` item carries the PNG as base64 and the file is saved at `$CODEX_HOME/generated_images/<threadId>/<itemId>.png`, which the model knows.
- A fake MCP `upload_image(path)` tool with `readOnlyHint: false` failed with "MCP tool call requires approval, but approval policy is never"; adding `tools.upload_image.approval_mode = "approve"` under the server in the `thread/start` config made it succeed, and the final answer embedded the returned Markdown.

## Decisions

1. **Upload by path for our own runs, by data for everyone.** Passing a 1–2 MB image as base64 in tool arguments is impractical for the model; a path is a few bytes. Reading server files by path is only safe for the server's own runs, so `path` requires an agent token and must resolve (realpath) inside a configured Codex home's `generated_images/`. External clients use `data`.
2. **Tool context carries the token kind.** `checkBearerToken` already knows the row; it now returns `kind`, and `AgentToolContext` gets `token_kind`.
3. **Per-tool annotations.** `AgentToolDef` gets optional `annotations`; default stays read-only. `/mcp` listing uses them.
4. **Provider support.** `ModelMcpServer` gains `enabled_tools?: string[]` and `approved_tools?: string[]`, mapped into the thread config (`enabled_tools`, `tools.<name>.approval_mode = "approve"`). Exec mode is unchanged (no MCP).
5. **Shared attach helper.** `attachAgentTools(input, userId, { tools?: string[] })` moves to a shared module (used by research with all tools, by Q&A with `['upload_image']`), always pre-approves `upload_image`, and appends the figure snippet to `input.system`. Q&A attaches only for Codex `stream: true` models (`getModelConfig(model).type === 'codex' && stream`), via an `agentUserId` option on `askQuestion`.
6. **Figure prompt as a file** (`prompts/agent/figures.md`), consistent with other prompt text; it overrides the bundled `imagegen` skill's "copy into the workspace" advice (the sandbox is read-only anyway).

## Risks / Trade-offs

- Generated files accumulate in `$CODEX_HOME/generated_images/`; left for a later cleanup change.
- Codex image generation consumes plan quota and its cost is not in token usage.
- Q&A gaining an MCP server adds startup latency (~0.3 s observed for server init).
- Weak settings may not follow the instruction: in verification `gpt-6-luna` (low effort) generated images but did not upload them (answer had an empty image link), while `gpt-6-astra` (medium) uploaded and embedded the figure. The instruction was made explicit (preview and Mermaid are invisible to readers); no server-side auto-upload fallback in this change.
- Fastify's default 1 MB body limit rejected a model's base64 `data` upload with 413; `/mcp` now sets a body limit derived from `image_host.max_size_mb`.

## Context

The previous change (`add-paper-refresh-and-manual-sources`, deployed but not yet archived) added:
- `papers.kind`;
- manual papers with link-based dedup;
- `contents.user_input` as manual content;
- the MCP write tools `add_paper` / `update_paper` (personal token only).

Blog import builds on those. The agent doing the import is the user's own coding agent, for example Claude Code with the Paperland MCP server configured using a personal token. It is not Paperland's Codex runs.

## Decisions

- **No new kind.** Use `article`, labelled "Blog post" in the UI. Project pages with only a PDF stay `paper`. A blog's identity is its `link`, which is already deduplicated.
- **Content lives in `contents.user_input`.** It already wins in `content_priority`, so Q&A, `read_paper` and full-text copy work on the blog text without changes.
- **The Article mode renders `user_input` through `MarkdownContent`.** Highlights and anchors in that component are opt-in props, so this mode gets plain rendering. Persisted highlights on article text are out of scope.
- **Video embeds use image syntax** (`![alt](x.mp4)`), recognised in the markdown-it image rule. `html: false` stays, so no sanitizer is needed. The `w=` directive is read from the alt text by `MarkdownContent`'s post-processing. That pass is extended from `img` to `video`.
- **Interactive HTML figures are not embedded as live HTML.** Rendering untrusted HTML or JS in the app would need a sandboxed iframe origin. Instead the skill says: tables become Markdown tables, charts become screenshots (one per state when toggles change the view), and animated figures can be recorded into a short mp4 when the source has no video. This is the "replicate if easy" path the user described, without an XSS surface.
- **Upload path for agents.** Base64 inside a tool call puts every byte into the model's context, so a 300 KB screenshot costs about 400K characters. The fix is `POST /external-api/v1/images` with the raw body (curl `--data-binary`), plus `url` fetching on the server for media that is already online. `storeImage` is split into `storeImageBytes(buf, opts)`, and the base64 wrapper is kept for the existing callers.
- **SSRF guard.** `fetchRemoteMedia` resolves the host with `dns.lookup(all)`. It rejects loopback, RFC 1918, link-local, CGNAT, unique-local and unspecified addresses, and IPv4-mapped forms of them. It follows redirects manually (at most 5), checking each hop, streams the body and aborts above the limit. The bytes must still sniff as an allowed image or video.
- **Video sniffing.**
  - MP4: `ftyp` at offset 4. The brands that matter here (isom, mp41, mp42, avc1, iso*, dash, M4V) all map to `video/mp4`; QuickTime `qt  ` is rejected.
  - WebM: EBML magic `1A 45 DF A3` together with a `webm` DocType in the first 4 KB.
  - Width and height stay null. The 6-hex hash naming is unchanged.
- **Range serving.** `/image/*` uses `statSync`, parses one `bytes=a-b` / `a-` / `-n` range and replies with `createReadStream` (206). Without a Range header it streams the whole file. Images keep working the same way.
- **Dates.**
  - `published_at` / `modified_at` live in `metadata`, so no migration is needed.
  - arXiv overwrites both, because it is the source of truth. S2 only fills `published_at` for papers without an arXiv id that have no date yet.
  - Validation accepts `YYYY-MM-DD` or a full ISO date-time that `Date.parse` accepts, and stores the string as given. `null` or an empty string clears the field.
  - Display uses the date part, without converting it to a time zone, so "2026-10-12" never shows as the 11th.
- **Backfill** is a one-off ops script making live arXiv calls: id_list batches of 50, 3 s apart, the same User-Agent as the service. It is not a unit test. It is run once on deploy, with the user's request as the authorization.
- **`get_skill`** reads `agent_tools.skills_dir/<name>/SKILL.md`. The name must match `^[a-z0-9-]+$`, which prevents path traversal. The listing parses the YAML front matter `name` / `description`.

## Risks

- A full mp4 is held in memory while it is stored (≤ 200 MB by default). This is acceptable at this scale.
- Blog Markdown can be large. The MCP body limit already allows about 130 MB.

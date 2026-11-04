## Why

The user wants their own coding agent to import well-known blog posts, which have no arXiv or Semantic Scholar id, so they can read them closely in Paperland. The agent should:

- Keep only the main content, as Markdown.
- Turn static HTML figures into region screenshots and rebuild simple ones (for example tables).
- Keep the post's videos.
- Record the original link, the publish time and the last-updated time.

Today:

- The paper's own Markdown (`contents.user_input`) is never displayed.
- The image host accepts only four image types. `POST /api/images` is also capped by Fastify's default 1 MiB body limit, despite its 18 MB setting.
- The only agent upload path is base64 inside an MCP call, which is impractical for screenshots and videos because it fills the agent's context.
- Publication and update dates are not stored for any paper. arXiv `published`/`updated` are not parsed. S2 `publicationDate` goes only into the `s2_papers` cache.

## What Changes

- **Blog posts** reuse `kind: 'article'`. The UI calls them "Blog post": the add-dialog option, and a "Blog post" badge in the list and detail header that links to the original page. That badge replaces the generic host badge for articles.
- **Article reader**: a new "Article" viewer mode renders the paper's Markdown content. It is the default mode for articles that have content. Videos in the Markdown play inline. Markdown image syntax whose URL ends in `.mp4`/`.webm` renders as `<video controls>`, since raw HTML stays disabled. Q&A on an article already uses that content (`content_priority: user_input` first).
- **Image host video support**:
  - mp4 and webm are sniffed, allowed by default, and limited by a separate `image_host.max_video_size_mb` (default 200).
  - `/image/*` streams files and answers HTTP Range requests (206), so videos can seek.
  - `POST /api/images` gets a body limit that matches the configured sizes.
  - The management page lists and plays videos and accepts video files.
- **Agent uploads without base64**:
  - New `POST /external-api/v1/images` (personal bearer token) takes either the raw file body or `?url=` to fetch a remote image or video on the server.
  - MCP `upload_image` gains a `url` input.
  - Remote fetches are http(s) only, refuse loopback/private addresses, and use the size limits and a timeout.
- **Publication dates**: `metadata.published_at` and `metadata.modified_at` (ISO 8601 date or date-time).
  - arXiv metadata stores `<published>` (v1) and `<updated>` (latest version).
  - S2 fills `published_at` from `publicationDate` for papers without an arXiv id that have no date yet.
  - Manual papers and blogs set both through PATCH / POST / `add_paper` / `update_paper`.
  - A one-off backfill script fills existing papers (arXiv API in batches, S2 dates from the `s2_papers` cache).
  - The detail header shows "Published …" and, when it differs, "Updated …". The edit form has both fields.
- **Blog import skill**: `prompts/skills/blog-import/SKILL.md` describes how an agent extracts the main content, captures figures (region screenshots of static figures, Markdown tables for tabular figures, one screenshot per state for small interactive charts), and uploads media and the post. It is served to external agents by a new read-only MCP tool `get_skill`, which is listed in the MCP instructions.
- Follow-up tweaks requested after the first deploy:
  - Articles without a PDF show no PDF tab or upload panel; "Full text" copies the article Markdown.
  - Article heading levels are renumbered on write so they run consecutively from `#`.
  - The blog's original URL is pinned as the first Reference link ("Original post").
  - Q&A on articles reads the Markdown directly (already first in `content_priority`, no PDF needed), and `<paper>` gets a title/authors/source/dates header since the Markdown has no title.
- Acceptance: import https://concept.dev/blog/dense-captioning through this flow.

## Capabilities

### New Capabilities
- `blog-post-import`: blog posts as articles, the Article reader, the "Blog post" badge, inline video in Markdown, the blog import skill and `get_skill`.
- `paper-dates`: `published_at` / `modified_at` sources, editing, display, and backfill.

### Modified Capabilities
- `image-host`: video types, a separate video size limit, Range serving, a raw / URL upload endpoint for agents, and a body limit matching the configured sizes.
- `research-agent-tools`: `upload_image` `url` input and the `get_skill` tool (added requirements only).

## Impact

- Backend:
  - `services/image_store.ts`, `api/images.ts`, `index.ts` (`/image/*` Range), new `external-api/images.ts`.
  - `services/agent_tools.ts`, `api/mcp.ts` (instructions).
  - `services/arxiv_service.ts`, `services/semantic_scholar_service.ts`, `services/paper_actions.ts` (date fields), `config.ts`.
  - New `scripts/backfill-paper-dates.ts`.
- Frontend:
  - `lib/markdown-renderer.ts`, `components/MarkdownContent.vue`, `components/PaperViewerPanel.vue`.
  - `views/PaperDetail.vue`, `views/PaperList.vue`, `views/ImageHostPage.vue`, `components/SourceTag.vue` (new `kind` prop renders the "Blog post" badge).
- Shared types. `prompts/skills/blog-import/SKILL.md`. `config.example.yml`, the docs.
- No DB migration. The dates live in `metadata`, and `kind: 'article'` already exists.
- Builds on the unarchived `add-paper-refresh-and-manual-sources` change (kind / add dialog / MCP write tools). It touches the same files.

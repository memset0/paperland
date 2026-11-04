## 1. Image host video and agent uploads

- [x] 1.1 `image_store.ts`: `storeImageBytes`, mp4/webm sniffing, `max_video_size_mb`, default allowed types; config schema (`max_video_size_mb`, `download_timeout`) + `config.example.yml`
- [x] 1.2 `/image/*` streaming with Range (206/416, Accept-Ranges)
- [x] 1.3 `POST /api/images` bodyLimit from config
- [x] 1.4 `fetchRemoteMedia` with SSRF guard, redirect re-check, timeout, size cap
- [x] 1.5 `POST /external-api/v1/images` (raw body or `?url=`), registered with tokenAuth
- [x] 1.6 MCP `upload_image` `url` input + description; `get_skill` tool; MCP instructions
- [x] 1.7 Tests (offline): sniffing, size limits, Range serving, SSRF guard, external upload endpoint, upload_image url (mocked fetch), get_skill

## 2. Dates

- [x] 2.1 arXiv metadata parses `<published>`/`<updated>` → `published_at`/`modified_at`
- [x] 2.2 S2 fills `published_at` from `publicationDate` for non-arXiv papers without one
- [x] 2.3 `paper_actions.ts` + MCP/External API/site: `published_at`/`modified_at` fields with `INVALID_DATE`; shared types
- [x] 2.4 `scripts/backfill-paper-dates.ts`
- [x] 2.5 Tests (offline) for parsing, S2 rule, validation

## 3. Frontend

- [x] 3.1 Markdown renderer: video for `.mp4`/`.webm` image syntax; width directive applies to videos
- [x] 3.2 Article viewer mode (default for articles with content)
- [x] 3.3 "Blog post" badge via `SourceTag` `kind` prop in list and detail headers (replaces host badge for articles); add-dialog label "Blog post"
- [x] 3.4 Detail header Published/Updated; edit form date inputs
- [x] 3.5 Image host page: video picker, previews

## 4. Skill, docs, acceptance

- [x] 4.1 `prompts/skills/blog-import/SKILL.md`
- [x] 4.2 Docs: frontend-architecture.md, external-api.md, tech-stack.md
- [x] 4.3 Deploy; run backfill; import https://concept.dev/blog/dense-captioning via the skill with a temporary personal token; verify in browser

## 5. Follow-ups after first deploy

- [x] 5.1 Hide the PDF tab / upload panel for articles without a PDF; article "Copy full text" copies the Markdown
- [x] 5.2 `utils/markdown_headings.ts#renumberHeadings` applied to article content on create/update (and when a paper becomes an article); skill updated; tests
- [x] 5.3 "Original post" pinned first in Reference links for articles
- [x] 5.4 Renumber paper 319's stored content; rebuild, deploy, verify
- [x] 5.5 Q&A on articles: `qa_formatter.ts#articleHeader` prefixes title/authors/source/dates to the Markdown in `<paper>`; tests; verified the built model input for paper 319

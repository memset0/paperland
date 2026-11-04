# blog-post-import Specification

## Purpose
Lets agents import web articles such as blog posts (no arXiv or Semantic Scholar id) as Markdown articles with screenshots and media in the image host, and lets users read and ask Q&A about them like papers.

## Requirements

### Requirement: Blog posts are articles
A blog post SHALL be stored as a paper with `kind: 'article'`, its original URL in `link`, its main content as Markdown in `contents.user_input`, and its dates in `metadata.published_at` / `metadata.modified_at`. The web UI SHALL call this kind "Blog post": the add dialog's type option and a "Blog post" badge. The badge SHALL be shown for articles in the paper list and in both detail header layouts, SHALL link to `link` in a new tab when a link is set, and SHALL replace the generic link-host badge for articles.

#### Scenario: Badge opens the original post
- **WHEN** the list shows an article whose link is "https://concept.dev/blog/dense-captioning"
- **THEN** its row SHALL show a "Blog post" badge linking to that URL and SHALL NOT show the "concept.dev" host badge

### Requirement: Article reader
The paper viewer SHALL offer an "Article" mode for articles whose `contents.user_input` is non-empty. It SHALL render that Markdown with the app's Markdown renderer, including math, image width directives, and inline video. It SHALL be the default mode for such papers. Papers of kind `paper` SHALL NOT get the mode.

#### Scenario: Open an imported blog post
- **WHEN** a user opens an article with Markdown content and no PDF
- **THEN** the viewer SHALL show the Article mode with the rendered content and SHALL NOT offer a PDF tab or the PDF upload panel

### Requirement: Articles do not ask for a PDF
An article without `pdf_path` SHALL NOT show the PDF viewer tab or the "PDF needed" upload panel. The PDF tab SHALL appear only once the article has a PDF (for example one given with `pdf_url`). The detail page's "Full text" copy for an article SHALL offer "Copy full text", which copies its Markdown content, plus the PDF parse copies only when they exist.

#### Scenario: Blog without a PDF
- **WHEN** a user opens a blog post without a PDF
- **THEN** the viewer tabs SHALL be "Article" and "Note", and "Full text" SHALL offer "Copy full text" only

### Requirement: Article heading levels are renumbered
When an article's content is written (`POST /api/papers`, `PATCH /api/papers/:id`, the External API PATCH, MCP `add_paper` / `update_paper`), or a paper with content becomes an article, the system SHALL renumber its ATX headings so the levels in use are consecutive from 1, in order. For example, `##`/`###` becomes `#`/`##`, and `#`/`###` becomes `#`/`##`. Lines inside fenced code blocks SHALL NOT change. Content of kind `paper` SHALL be stored as given.

#### Scenario: Post starting at h2
- **WHEN** an agent adds an article whose sections use `##` and subsections `###`
- **THEN** the stored content SHALL use `#` and `##`

### Requirement: Source link is the first reference link
For articles with a `link`, the Reference links section SHALL show an "Original post" entry first, linking to `link` in a new tab and showing the URL. The entry is derived from the paper (not a stored reference link), cannot be edited or deleted, and is shown in both the Mine and All scopes.

#### Scenario: Reference links of a blog post
- **WHEN** a user opens the blog post imported from https://concept.dev/blog/dense-captioning
- **THEN** the first reference link SHALL be "Original post" pointing to that URL, followed by any user-added links

### Requirement: Inline video in Markdown
The Markdown renderer SHALL render image syntax whose URL path ends in `.mp4` or `.webm` (case-insensitive, ignoring query and fragment) as a `<video>` element with controls, `preload="metadata"`, `playsinline`, and the alt text as its `aria-label`, instead of an `<img>`. The `w=` width directive in the alt text SHALL apply to videos like images. Raw HTML SHALL remain disabled.

#### Scenario: Video embed
- **WHEN** content contains `![Clip w=md](/image/2026/10/16/abc123.mp4)`
- **THEN** it SHALL render as a playable video at the medium width

### Requirement: Blog import skill for agents
The repository SHALL ship a skill at `prompts/skills/blog-import/SKILL.md` that tells a coding agent how to import a blog post:
- Fetch the page and extract the title, authors, publish and modified times (`article:published_time` / `article:modified_time` meta, JSON-LD `datePublished` / `dateModified`, visible dates), and only the main content as Markdown.
- Handle figures:
  - Upload ordinary images and videos from their URLs.
  - Take region screenshots (headless browser, element bounding box, device scale factor ≥ 2) of static HTML/SVG figures.
  - Rebuild tabular figures as Markdown tables.
  - For small interactive figures, capture one screenshot per meaningful state.
  - Keep figure captions.
- Upload local files through `POST /external-api/v1/images` with the same personal token, and remote media with `upload_image(url)`.
- Create the paper with `add_paper(kind: "article", link, published_at, modified_at, content, …)`, then verify it.

The MCP server SHALL provide a read-only tool `get_skill(name?)`. Without a name it lists the bundled skills (name and description from each `SKILL.md` front matter); with a name it returns that skill's text. An unknown name SHALL be a tool error. The MCP `instructions` SHALL mention `get_skill("blog-import")` for importing web articles.

#### Scenario: Agent discovers the skill
- **WHEN** an external agent calls `get_skill` with no arguments
- **THEN** the result SHALL include `blog-import` with its description

### Requirement: Q&A on articles reads the Markdown directly
Q&A on an article SHALL use its stored Markdown (`contents.user_input`, first in `content_priority`) as the paper text, with no PDF, PDF parse, or doc2x step required. Without a PDF, the mechanical-text confirmation SHALL NOT appear. Because the Markdown carries no title, the `<paper>` block of an article whose text comes from `user_input` SHALL start with a short header (`Title:`, then, when known, `Authors:`, `Published in:`, `Source:` (the link), `Published:`, `Last updated:` as calendar dates), followed by a blank line and the Markdown. Papers of kind `paper`, and articles answered from a PDF parse, SHALL get no header.

#### Scenario: Ask about an imported blog post
- **WHEN** a user asks a question on the blog post imported from concept.dev
- **THEN** the model input's `<paper>` SHALL begin with "Title: Frontier models can’t yet label robot training data accurately", the authors, the source URL and both dates, followed by the post's Markdown, and no confirmation SHALL be shown

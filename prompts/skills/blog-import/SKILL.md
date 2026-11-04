---
name: blog-import
description: Import a blog post or other web article into Paperland for close reading — main content as Markdown, figures as uploaded images (screenshots of HTML/SVG figures, tables rebuilt in Markdown), videos kept, original link and publish/update dates recorded. Use when asked to add, dump, or import a web page that has no arXiv / Semantic Scholar id.
---

# Importing a blog post into Paperland

The goal is a faithful, readable copy of the article's **main content**, so the user can study it
in Paperland's Article view and ask Q&A about it. Paperland stores it as a paper with
`kind: "article"` (shown as "Blog post"), the Markdown in `content`, and a badge that links back
to the original page.

You need the `paperland` MCP tools and a **personal** token (the same bearer token your MCP
client uses). `<origin>` below is the Paperland origin from your MCP URL (the part before `/mcp`).

## 1. Check it is not already there

Call `search_papers` with the title. `add_paper` also deduplicates by link (http/https,
`www.` and a trailing `/` are ignored), returning `created: false` for an existing post. In that
case update it with `update_paper` instead of creating a new one.

## 2. Fetch and read the page

Fetch the HTML (send a normal browser User-Agent). Many posts render with JavaScript; if the
static HTML lacks the body text or figures, load the page in a headless browser (Chrome /
Playwright) and wait for the network to go idle.

Collect:
- **title**: `og:title`, else the `<h1>`.
- **authors**: byline, `author` meta, or JSON-LD `author`. Use the organization name if no person is named.
- **link**: the canonical URL (`<link rel="canonical">` or `og:url`).
- **published_at**: `article:published_time` meta, JSON-LD `datePublished`, or the visible date.
- **modified_at**: `article:modified_time`, JSON-LD `dateModified`, or a visible "Updated …" date.
  These sources can disagree (for example meta says 10-12, JSON-LD says 10-13). Prefer the most
  specific and latest-maintained source, which is usually JSON-LD. Keep them as ISO 8601: `YYYY-MM-DD`,
  or a full date-time when one is given. Omit a date you cannot find; never invent one.
- **venue**: the blog or site name (for example `og:site_name`).
- **abstract**: the post's dek or `og:description`, or the first paragraph.

## 3. Write the Markdown (main content only)

Keep the article body in reading order, including headings, paragraphs, lists, block quotes,
code blocks, footnotes, and inline links (made absolute). Drop navigation, headers and footers,
share buttons, newsletter boxes, "related posts", cookie banners, and decorative logos and
avatars. Do not paraphrase or summarize: copy the text. Math goes in `$…$` / `$$…$$` (KaTeX).
Raw HTML is **not** rendered, so express everything in Markdown. Don't repeat the title as a heading (Paperland shows it). Start section headings at `#`; Paperland renumbers the heading levels of an article so they run consecutively from level 1 anyway.

### Figures

Handle each `<figure>` (or equivalent) by type, and always keep its caption as an italic line
directly below it, for example `*Figure 2. …*`.

| Source figure | What to do |
|---|---|
| `<img>` / `<picture>` | Upload the original URL with `upload_image(url=…)`. Use the largest `srcset` candidate. |
| `<video>` (mp4 / webm) | Upload its `src` with `upload_image(url=…)` and embed it with the same `![alt](url)` syntax, which plays inline. Optionally upload the `poster` too. |
| Static HTML / SVG chart, diagram, or styled layout | Take a **region screenshot** of just that element (see below) and upload it. |
| Figure that is really a table | Rebuild it as a Markdown table, keeping its numbers exactly. Also screenshot it if the visual encoding (colors, bars) matters. |
| Small interactive figure (toggle buttons, tabs, hover states) | Take one screenshot per meaningful state (click each toggle), each with a caption naming the state. |
| Animation without a source video | Record a short clip (for example with the Chrome DevTools screencast or Playwright video, then convert it to mp4 with ffmpeg) and upload it, or else screenshot the key frames. |
| Embedded iframe (YouTube, Observable, …) | Link to it: `[▶ Video: title](url)`. |

Width hint: put `w=sm`, `w=md` or `w=lg` in the alt text (`![Figure 2 w=lg](url)`) when a figure
should not be full width. Wide figures need no hint.

### Region screenshots

Use a headless browser:
- Set a desktop viewport, at least 1280 px wide, with `deviceScaleFactor` of 2.
- Use the light color scheme unless the site is dark-only.
- Wait for fonts and images to load. Scroll the element into view so lazy content renders.
- Screenshot **only the element's bounding box** (the Playwright `locator.screenshot()`, or CDP
  `Page.captureScreenshot` with a `clip` from `getBoundingClientRect()`). Include the figure's
  own legend, but not the caption text, which goes in Markdown.
- Hide sticky headers and cookie banners that overlap it.

### Uploading files

- **Online media**: `upload_image(url="https://…/clip.mp4", alt="…")`. Paperland downloads it.
- **Local files** such as screenshots or recordings: never send base64 through the tool, because it
  floods your context. Instead run:

  ```
  curl -sS -X POST -H "Authorization: Bearer $PAPERLAND_TOKEN" \
    -H "Content-Type: image/png" --data-binary @fig2.png \
    "<origin>/external-api/v1/images?filename=fig2.png&alt=Figure%202"
  ```

  The JSON response has `url` and `markdown`. Use `video/mp4` for clips.
- Embed the returned `markdown` or `url` exactly. The URLs are site-relative (`/image/…`), which
  is correct. Never leave links pointing at the original site's images, and never use local paths.

## 4. Create the paper

```
add_paper(
  kind: "article", title, authors, link, abstract, venue,
  year: <publish year>, published_at, modified_at,
  content: <the Markdown>, tags: [optional]
)
```

Use `update_paper(paper_id, …)` to fix anything afterwards, for example re-uploading a figure and
replacing `content`. If the post links a PDF version, also pass `pdf_url`.

## 5. Verify

- `read_paper(paper_id)` returns your Markdown. Check that every figure and video in the original
  has an embed, every caption survived, and no `http` image links to the source site remain.
- Report the paper's `paperland://paper/<id>` link and anything you could not capture. For
  example, an interactive figure reduced to screenshots.

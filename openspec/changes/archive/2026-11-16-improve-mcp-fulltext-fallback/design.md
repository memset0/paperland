# Design

## Context

`read_paper` resolves text through `resolvePaperContent` (`content_priority`: user_input > doc2x_parsed > pdf_parsed). `pdf_parse_service` (unpdf) and `doc2x_parse` are both queued paper-bound services that depend on `pdf_path`. `read_pdf_page` already runs Poppler's `pdftotext` under a shared semaphore, a timeout and an output cap, against PDFs confined to the data directory. `isDoc2xParseEligible` decides whether doc2x will run for a paper.

## Goals / Non-Goals

**Goals:** a usable answer at every stage of import; an explicit signal of quality and pending improvements; guidance to re-check on the next user turn.

**Non-Goals:** fetching arXiv HTML server-side (the client model fetches it); storing the on-the-fly text in the database or changing `content_priority`; changing the import pipeline or service scheduling.

## Decisions

- **Precision by source.** `user_input` and `doc2x_parsed` are `precise`. `pdf_parsed` and on-the-fly `pdf_text` are `rough`. Unknown future sources default to `rough`, the cautious choice.
- **`precise_pending`.** True when the text is not already precise, `isDoc2xParseEligible(paper)` holds or the PDF is still being fetched for an eligible new paper, and the latest `doc2x_parse` execution is not `failed`. A failed doc2x run means no promise of a precise version.
- **On-the-fly extraction reuses `pdf_pages`.** A new exported `readPdfText(paperId)` in `pdf_pages.ts` shares the path confinement, semaphore, timeout and the existing `max_image_bytes` output cap. It runs `pdftotext -layout` over the whole document. Results are cached in memory, keyed by paper id plus PDF path and mtime, with a small LRU (8 entries), so paging through `offset` does not re-run Poppler. Alternative considered: enqueue `pdf_parse_service` immediately. Rejected because the agent needs text within this tool call.
- **Not ready is not an error.** ChatGPT and other clients treat `isError` as a failure and often stop. A structured `status: not_ready` result with links and a next step keeps the conversation going. Outline mode on rough text returns whatever headings exist (often none) and carries the same labels.
- **Re-check wording lives in the result, not only in the description,** because chat clients reread tool results on later turns more reliably than descriptions.

## Risks / Trade-offs

- [Large PDFs exceed the output cap or timeout] → Fall back to the `not_ready` shape with `pdf_status` `available` and a note to read individual pages with `read_pdf_page`.
- [Poppler missing on a host] → Same fallback. The tool never fails harder than before.
- [Cache memory] → Bounded to 8 documents of at most `max_image_bytes` each.

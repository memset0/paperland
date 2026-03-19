/**
 * Extract arXiv ID from a Zotero item.
 * Checks archiveID → extra → url in priority order.
 * Returns the bare ID (e.g. "2603.04948") or null.
 */
export function extractArxivId(item: any): string | null {
  if (!item) return null;

  function tryExtract(text: string | null | undefined): string | null {
    if (!text) return null;
    // Modern format: arXiv:YYMM.NNNNN(vN)
    let m = text.match(/arXiv[:\s]+(\d{4}\.\d{4,5}(?:v\d+)?)/i);
    if (m) return m[1];
    // Legacy format: arXiv:category/NNNNNNN(vN)
    m = text.match(/arXiv[:\s]+([\w.-]+\/\d{7}(?:v\d+)?)/i);
    if (m) return m[1];
    return null;
  }

  // 1. archiveID (format: "arXiv:2603.04948")
  try {
    const archiveId = item.getField("archiveID");
    const id = tryExtract(archiveId);
    if (id) return id;
  } catch (_) {}

  // 2. Extra field (may contain "arXiv: 1706.03762" among other text)
  try {
    const extra = item.getField("extra");
    const id = tryExtract(extra);
    if (id) return id;
  } catch (_) {}

  // 3. URL (https://arxiv.org/abs/2301.12345)
  try {
    const url = item.getField("url");
    if (url) {
      let m = url.match(
        /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i,
      );
      if (m) return m[1];
      m = url.match(
        /arxiv\.org\/(?:abs|pdf)\/([\w.-]+\/\d{7}(?:v\d+)?)/i,
      );
      if (m) return m[1];
    }
  } catch (_) {}

  return null;
}

import { getPref } from "./prefs";

interface ResolveResult {
  ok: boolean;
  id?: number;
  error?: string;
}

/**
 * Look up (or auto-create) a paper in Paperland by arXiv ID.
 * Uses Zotero.HTTP.request() since fetch/AbortController aren't available in the sandbox.
 */
export async function resolvePaperId(arxivId: string): Promise<ResolveResult> {
  // Check session cache first
  const cache = addon.data.cache;
  if (cache.has(arxivId)) {
    return { ok: true, id: cache.get(arxivId)! };
  }

  const host = getPref("host");
  const token = getPref("api_token");

  if (!host) {
    return { ok: false, error: "Host not configured. Open plugin preferences." };
  }
  if (!token) {
    return { ok: false, error: "API token not configured. Open plugin preferences." };
  }

  const baseUrl = host.replace(/\/+$/, "");
  const url = `${baseUrl}/external-api/v1/papers/full?arxiv_id=${encodeURIComponent(arxivId)}&auto_create=true`;

  try {
    Zotero.debug(`[Paperland] Resolving arXiv:${arxivId} via ${url}`);

    const resp = await Zotero.HTTP.request("GET", url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "json",
      timeout: 30000,
    });

    const data = typeof resp.response === "string"
      ? JSON.parse(resp.response)
      : resp.response;

    const paperId = data?.paper?.id;

    if (paperId == null) {
      Zotero.debug("[Paperland] API response missing paper.id: " + JSON.stringify(data).substring(0, 200));
      return { ok: false, error: "Unexpected API response \u2014 no paper ID returned." };
    }

    Zotero.debug(`[Paperland] Resolved arXiv:${arxivId} -> paper #${paperId}`);
    cache.set(arxivId, paperId);
    return { ok: true, id: paperId };
  } catch (e: any) {
    const status = e.status || e.xmlhttp?.status;
    if (status === 401) {
      return { ok: false, error: "Invalid API token (401). Check preferences." };
    }
    Zotero.debug(`[Paperland] API error: ${e.message || e}`);
    return { ok: false, error: `Network error: ${e.message || e}` };
  }
}

interface LookupResult {
  ok: boolean;
  id?: number;
}

/**
 * Look up a paper in Paperland by arXiv ID without auto-creating.
 * Returns { ok: true, id } if found, { ok: false } if not found or error.
 */
export async function lookupPaper(arxivId: string): Promise<LookupResult> {
  const host = getPref("host");
  const token = getPref("api_token");
  if (!host || !token) return { ok: false };

  const baseUrl = host.replace(/\/+$/, "");
  const url = `${baseUrl}/external-api/v1/papers?arxiv_id=${encodeURIComponent(arxivId)}`;

  try {
    const resp = await Zotero.HTTP.request("GET", url, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "json",
      timeout: 15000,
    });

    const data = typeof resp.response === "string"
      ? JSON.parse(resp.response)
      : resp.response;

    const paperId = data?.paper?.id;
    if (paperId == null) return { ok: false };
    return { ok: true, id: paperId };
  } catch {
    return { ok: false };
  }
}

interface SyncTagsResult {
  ok: boolean;
  count?: number;
  error?: string;
}

/**
 * Sync Zotero item tags to Paperland (add-only, never removes).
 * Skips the call if tagNames is empty.
 */
export async function syncTags(paperId: number, tagNames: string[]): Promise<SyncTagsResult> {
  if (tagNames.length === 0) {
    return { ok: true, count: 0 };
  }

  const host = getPref("host");
  const token = getPref("api_token");
  if (!host || !token) {
    return { ok: false, error: "Host or token not configured" };
  }

  const baseUrl = host.replace(/\/+$/, "");
  const url = `${baseUrl}/external-api/v1/papers/${paperId}/tags`;

  try {
    Zotero.debug(`[Paperland] Syncing ${tagNames.length} tags for paper #${paperId}`);

    await Zotero.HTTP.request("PATCH", url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ add: tagNames }),
      responseType: "json",
      timeout: 15000,
    });

    Zotero.debug(`[Paperland] Tags synced for paper #${paperId}: ${tagNames.join(", ")}`);
    return { ok: true, count: tagNames.length };
  } catch (e: any) {
    Zotero.debug(`[Paperland] Tag sync error: ${e.message || e}`);
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Build the full URL to the Paperland paper detail page,
 * optionally embedding Basic Auth credentials.
 * When embed is true, appends ?embed=1&bg=f2f2f2 for sidebar display.
 */
export function buildPageUrl(paperId: number, embed = false): string | null {
  const host = getPref("host");
  if (!host) return null;

  const baseUrl = host.replace(/\/+$/, "");
  const username = getPref("username");
  const password = getPref("password");

  let url: string;
  if (username && password) {
    // Embed Basic Auth in URL: https://user:pass@host/papers/id
    const parsed = new URL(baseUrl);
    parsed.username = username;
    parsed.password = password;
    url = `${parsed.origin}/papers/${paperId}`;
  } else {
    url = `${baseUrl}/papers/${paperId}`;
  }

  if (embed) {
    url += "?embed=1&bg=f2f2f2";
  }

  return url;
}

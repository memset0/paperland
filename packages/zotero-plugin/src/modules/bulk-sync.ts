import { extractArxivId } from "./arxiv";
import { lookupPaper, syncTags } from "./api";

/**
 * Bulk sync all Zotero tags to Paperland for papers that exist on both sides.
 * Updates the status label in the preferences UI with progress and results.
 */
export async function bulkSyncTags(doc: Document) {
  const btn = doc.getElementById("pref-sync-btn") as HTMLButtonElement | null;
  const statusEl = doc.getElementById("pref-sync-status") as HTMLElement | null;
  if (!btn || !statusEl) return;

  btn.disabled = true;
  statusEl.style.color = "#666";
  statusEl.textContent = "Scanning library…";

  try {
    // Get all regular items from the user's library
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID);

    // Filter to items with arXiv IDs
    const arxivItems: Array<{ item: any; arxivId: string }> = [];
    for (const item of items) {
      if (item.isNote?.() || item.isAttachment?.()) continue;
      const arxivId = extractArxivId(item);
      if (arxivId) {
        arxivItems.push({ item, arxivId });
      }
    }

    if (arxivItems.length === 0) {
      statusEl.textContent = "No arXiv papers found in library.";
      return;
    }

    let synced = 0;
    let notFound = 0;
    let errors = 0;
    let skippedNoTags = 0;

    for (let i = 0; i < arxivItems.length; i++) {
      const { item, arxivId } = arxivItems[i];
      statusEl.textContent = `Syncing ${i + 1}/${arxivItems.length}…`;

      try {
        const lookup = await lookupPaper(arxivId);
        if (!lookup.ok || lookup.id == null) {
          notFound++;
          continue;
        }

        // Get tags from Zotero item
        const tags: string[] = item.getTags?.()?.map((t: any) => t.tag || t) || [];
        if (tags.length === 0) {
          skippedNoTags++;
          continue;
        }

        const result = await syncTags(lookup.id, tags);
        if (result.ok) {
          synced++;
        } else {
          errors++;
        }
      } catch (e: any) {
        Zotero.debug(`[Paperland] Bulk sync error for ${arxivId}: ${e.message || e}`);
        errors++;
      }
    }

    // Summary
    const parts: string[] = [];
    if (synced > 0) parts.push(`${synced} synced`);
    if (notFound > 0) parts.push(`${notFound} not in Paperland`);
    if (skippedNoTags > 0) parts.push(`${skippedNoTags} no tags`);
    if (errors > 0) parts.push(`${errors} errors`);

    statusEl.textContent = `✓ Done (${arxivItems.length} arXiv papers): ${parts.join(", ")}`;
    statusEl.style.color = errors > 0 ? "#e65100" : "#2e7d32";
  } catch (e: any) {
    statusEl.textContent = `✗ Error: ${e.message || e}`;
    statusEl.style.color = "#c62828";
  } finally {
    btn.disabled = false;
  }
}

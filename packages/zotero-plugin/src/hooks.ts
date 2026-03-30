import { config } from "../package.json";
import { bulkSyncTags } from "./modules/bulk-sync";
import { registerPanel, unregisterPanel } from "./modules/panel";
import { getPref } from "./modules/prefs";

export const hooks = {
  async onStartup() {
    await Zotero.initializationPromise;

    // Register preferences pane in Zotero's main Settings dialog
    Zotero.PreferencePanes.register({
      pluginID: config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: "Paperland",
      image: rootURI + "content/icons/icon.svg",
    });

    registerPanel();
    addon.data.initialized = true;
    Zotero.debug("[Paperland] Plugin started");
  },

  async onMainWindowLoad(_window: Window) {
    // Nothing extra needed — panel is registered globally
  },

  async onMainWindowUnload(_window: Window) {
    // Nothing extra needed
  },

  async onShutdown() {
    unregisterPanel();
    addon.data.cache.clear();
    Zotero.debug("[Paperland] Plugin shut down");
  },

  onPrefsLoad(doc: Document) {
    // Bulk sync button
    const syncBtn = doc.getElementById("pref-sync-btn");
    if (syncBtn) {
      syncBtn.addEventListener("click", () => bulkSyncTags(doc));
    }

    // Test connection button
    const btn = doc.getElementById("pref-test-btn");
    const resultEl = doc.getElementById("pref-test-result");
    if (!btn || !resultEl) return;

    btn.addEventListener("click", async () => {
      const host = getPref("host");
      const token = getPref("api_token");

      if (!host) {
        resultEl.textContent = "\u2717 Host URL is empty";
        (resultEl as HTMLElement).style.color = "#c62828";
        return;
      }
      if (!token) {
        resultEl.textContent = "\u2717 API token is empty";
        (resultEl as HTMLElement).style.color = "#c62828";
        return;
      }

      (btn as HTMLButtonElement).disabled = true;
      resultEl.textContent = "Testing\u2026";
      (resultEl as HTMLElement).style.color = "#666";

      try {
        const baseUrl = host.replace(/\/+$/, "");
        const resp = await Zotero.HTTP.request("GET", baseUrl + "/external-api/v1/health", {
          headers: { Authorization: "Bearer " + token },
          responseType: "json",
          timeout: 10000,
        });
        if (resp.status >= 200 && resp.status < 300) {
          resultEl.textContent = "\u2713 Connection successful";
          (resultEl as HTMLElement).style.color = "#2e7d32";
        } else if (resp.status === 401) {
          resultEl.textContent = "\u2717 Invalid API token (401)";
          (resultEl as HTMLElement).style.color = "#c62828";
        } else {
          resultEl.textContent = "\u2717 Server error (HTTP " + resp.status + ")";
          (resultEl as HTMLElement).style.color = "#c62828";
        }
      } catch (e: any) {
        const msg = e.status === 401
          ? "\u2717 Invalid API token (401)"
          : "\u2717 Cannot connect: " + (e.message || e);
        resultEl.textContent = msg;
        (resultEl as HTMLElement).style.color = "#c62828";
      } finally {
        (btn as HTMLButtonElement).disabled = false;
      }
    });
  },
};

import { config } from "../../package.json";
import { extractArxivId } from "./arxiv";
import { resolvePaperId, buildPageUrl } from "./api";
import { getPref } from "./prefs";

const SECTION_ID = "paperland-section";
const BROWSER_ID = "paperland-browser";

function log(msg: string) {
  Zotero.debug("[Paperland] " + msg);
}

export function registerPanel() {
  log("Registering panel section...");
  Zotero.ItemPaneManager.registerSection({
    paneID: SECTION_ID,
    pluginID: config.addonID,
    header: {
      l10nID: `${config.addonRef}-panel-header`,
      icon: `chrome://${config.addonRef}/content/icons/icon.svg`,
    },
    sidenav: {
      l10nID: `${config.addonRef}-panel-sidenav`,
      icon: `chrome://${config.addonRef}/content/icons/icon.svg`,
    },

    onRender({ body, item, doc }: { body: HTMLElement; item: any; doc: Document }) {
      log("onRender called, item=" + (item ? item.id : "null"));

      // Status text area
      const status = doc.createElement("div");
      status.id = "paperland-status";
      status.style.cssText = "padding:12px 16px;font-size:13px;color:#666;";
      body.append(status);

      // Check if item has arXiv ID
      if (!item || !item.isRegularItem?.()) {
        status.textContent = "Select an arXiv paper to view in Paperland";
        status.style.color = "#888";
        return;
      }

      const arxivId = extractArxivId(item);
      if (!arxivId) {
        status.textContent = "This item has no arXiv ID";
        status.style.color = "#888";
        return;
      }

      if (!getPref("host")) {
        status.textContent = "Paperland host not configured. Open Settings \u2192 Paperland.";
        status.style.color = "#c62828";
        return;
      }

      status.textContent = `Loading arXiv:${arxivId}\u2026`;

      // Create browser element (following Zotero forum pattern)
      const browser = (doc as any).createXULElement("browser");
      browser.id = BROWSER_ID;
      browser.setAttribute("type", "content");
      browser.setAttribute("remote", "true");
      browser.setAttribute("maychangeremoteness", "true");
      browser.setAttribute("disableglobalhistory", "true");
      browser.style.width = "100%";
      browser.style.height = "calc(100vh - 200px)";
      browser.style.minHeight = "400px";
      browser.style.display = "block";
      browser.style.border = "none";
      body.append(browser);
      log("XUL browser element created with remote=true");
    },

    async onAsyncRender({ body, item }: { body: HTMLElement; item: any }) {
      log("onAsyncRender called");

      const status = body.querySelector("#paperland-status") as HTMLElement;
      const browser = body.querySelector(`#${BROWSER_ID}`) as any;

      if (!status || !browser) {
        log("No status or browser element found — item likely has no arXiv ID");
        return;
      }

      if (!item || !item.isRegularItem?.()) return;

      const arxivId = extractArxivId(item);
      if (!arxivId) return;

      try {
        const result = await resolvePaperId(arxivId);

        if (!result.ok) {
          status.textContent = result.error || "Failed to resolve paper";
          status.style.color = "#c62828";
          browser.style.display = "none";
          return;
        }

        const pageUrl = buildPageUrl(result.id!);
        log("Setting browser src=" + pageUrl);

        // Update status with link
        status.innerHTML = "";
        const link = (body.ownerDocument).createElement("a");
        link.textContent = `\u2197 Open in browser`;
        link.style.cssText = "color:#1976d2;cursor:pointer;text-decoration:underline;margin-right:12px;";
        link.addEventListener("click", (e) => {
          e.preventDefault();
          // Strip credentials from URL for external browser
          const cleanUrl = (pageUrl || "").replace(/\/\/[^:]+:[^@]+@/, "//");
          Zotero.launchURL(cleanUrl);
        });
        status.appendChild(link);

        const info = (body.ownerDocument).createElement("span");
        info.textContent = `arXiv:${arxivId} \u2192 Paper #${result.id}`;
        info.style.color = "#888";
        status.appendChild(info);

        // Set browser src
        if (pageUrl) {
          browser.src = pageUrl;
        }
      } catch (e: any) {
        log("Error in onAsyncRender: " + e.message);
        if (status) {
          status.textContent = "Error: " + (e.message || e);
          status.style.color = "#c62828";
        }
      }
    },

    onItemChange({
      setEnabled,
    }: {
      body: HTMLElement;
      item: any;
      setEnabled: (v: boolean) => void;
    }) {
      log("onItemChange called");
      if (setEnabled) setEnabled(true);
    },

    onDestroy({ body }: { body: HTMLElement }) {
      log("onDestroy called");
      while (body.firstChild) body.removeChild(body.firstChild);
    },
  });
  log("registerPanel done");
}

export function unregisterPanel() {
  log("Unregistering panel section...");
  Zotero.ItemPaneManager.unregisterSection(SECTION_ID);
}

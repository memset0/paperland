import { config } from "../../package.json";

const PREFIX = config.prefsPrefix;

export function getPref(key: string): string {
  return (Zotero.Prefs.get(`${PREFIX}.${key}`, true) as string) || "";
}

export function setPref(key: string, value: string): void {
  Zotero.Prefs.set(`${PREFIX}.${key}`, value, true);
}

import { config } from "../package.json";
import Addon from "./addon";

const addon = new Addon();
_globalThis.addon = addon;
(Zotero as any)[config.addonInstance] = addon;

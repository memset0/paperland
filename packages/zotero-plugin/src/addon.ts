import { config } from "../package.json";
import { hooks } from "./hooks";

export default class Addon {
  public data = {
    config,
    initialized: false,
    /** arXiv ID → Paperland paper ID (session cache) */
    cache: new Map<string, number>(),
  };

  public hooks = hooks;
}

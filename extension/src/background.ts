import { judgePage, type PageVerdict, type Tracked } from "./logic";
import { quorumView } from "../../src/lib/rpc";
import type { RegistryEntry } from "../../src/lib/registry";

declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Config {
  registry: string;
  protocols: string[];
  evacUrl: string;
}
const DEFAULTS: Config = { registry: "", protocols: ["burrow"], evacUrl: "http://localhost:3001/dashboard" };
const STALE_MS = 5 * 60_000;

async function getConfig(): Promise<Config> {
  const s = await chrome.storage.local.get("config");
  return { ...DEFAULTS, ...(s.config ?? {}) };
}

async function refresh(force = false): Promise<{ tracked: Tracked[]; at: number; error: string }> {
  const s = await chrome.storage.local.get("cache");
  const cfg = await getConfig();
  const c = s.cache as { tracked: Tracked[]; at: number; key: string } | undefined;
  const key = cfg.registry + "|" + cfg.protocols.join(",");
  if (!force && c && c.key === key && Date.now() - c.at < STALE_MS) return { tracked: c.tracked, at: c.at, error: "" };
  if (!cfg.registry) return { tracked: [], at: 0, error: "No registry set yet. Open the extension options." };
  try {
    const tracked: Tracked[] = [];
    for (const protocol of cfg.protocols) {
      const r = await quorumView<RegistryEntry | null>(cfg.registry, "get_entry", { protocol });
      tracked.push({ protocol, entry: r.value });
    }
    const at = Date.now();
    await chrome.storage.local.set({ cache: { tracked, at, key } });
    return { tracked, at, error: "" };
  } catch (e) {
    // Keep serving the last good copy if the network is down.
    if (c && c.key === key) return { tracked: c.tracked, at: c.at, error: `Could not refresh (${e instanceof Error ? e.message : e}). Showing the last copy.` };
    return { tracked: [], at: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const fetchText = async (url: string) => {
  const r = await fetch(url, { credentials: "omit", cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.text();
};

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("refresh", { periodInMinutes: 5 }));
chrome.alarms.onAlarm.addListener((a: { name: string }) => a.name === "refresh" && refresh(true));

chrome.runtime.onMessage.addListener((msg: { type: string; url?: string }, _s: unknown, reply: (v: unknown) => void) => {
  (async () => {
    if (msg.type === "judge" && msg.url) {
      const { tracked } = await refresh();
      const v: PageVerdict = await judgePage(tracked, msg.url, fetchText, fetchText);
      reply(v);
    } else if (msg.type === "state") {
      const r = await refresh(true);
      reply({ ...r, config: await getConfig() });
    } else if (msg.type === "save") {
      await chrome.storage.local.set({ config: (msg as unknown as { config: Config }).config, cache: null });
      reply({ ok: true });
    } else reply(null);
  })().catch((e) => reply({ kind: "none", error: String(e) }));
  return true;
});

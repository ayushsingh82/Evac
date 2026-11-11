// Decides what to tell the user about the page they are on. Pure apart from the injected fetchers, so it is unit-tested.
import { compareFingerprint, decideStatus, fingerprintPage, parseFingerprint } from "../../src/lib/sitecheck";
import type { RegistryEntry } from "../../src/lib/registry";

export interface Tracked {
  protocol: string;
  entry: RegistryEntry | null;
}

export type PageVerdict =
  | { kind: "none" }
  | { kind: "ok"; protocol: string }
  | { kind: "lookalike"; protocol: string; official: string }
  | { kind: "alarm"; protocol: string; status: string; note: string }
  | { kind: "tampered"; protocol: string; note: string };

const bare = (h: string) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True for the official host and any subdomain of it. */
export function isOfficial(host: string, officialUrl: string): boolean {
  const o = hostOf(officialUrl);
  return !!o && (host === o || host.endsWith("." + o));
}

export function isBlocklisted(host: string, list: string[]): boolean {
  return list.map(bare).some((b) => b && (host === b || host.endsWith("." + b)));
}

export async function judgePage(
  tracked: Tracked[],
  pageUrl: string,
  fetchHtml: (url: string) => Promise<string>,
  fetchScript: (url: string) => Promise<string>,
): Promise<PageVerdict> {
  const host = hostOf(pageUrl);
  if (!host) return { kind: "none" };
  for (const t of tracked) {
    const e = t.entry;
    if (!e) continue;
    if (isBlocklisted(host, e.blocklist)) return { kind: "lookalike", protocol: t.protocol, official: e.url };
  }
  for (const t of tracked) {
    const e = t.entry;
    if (!e || !e.url || !isOfficial(host, e.url)) continue;
    if (e.status === "Compromised") return { kind: "alarm", protocol: t.protocol, status: e.status, note: e.status_note };
    const baseline = parseFingerprint(e.site);
    if (baseline) {
      try {
        const html = await fetchHtml(pageUrl);
        const actual = await fingerprintPage(html, pageUrl, fetchScript);
        const d = decideStatus(compareFingerprint(baseline, actual), actual);
        if (d.status === "Compromised") return { kind: "tampered", protocol: t.protocol, note: d.note };
      } catch {
        /* could not check: say nothing rather than cry wolf */
      }
    }
    if (e.status === "Degraded") return { kind: "alarm", protocol: t.protocol, status: e.status, note: e.status_note };
    return { kind: "ok", protocol: t.protocol };
  }
  return { kind: "none" };
}

export function bannerText(v: PageVerdict): { level: "bad" | "warn"; title: string; body: string } | null {
  switch (v.kind) {
    case "lookalike":
      return {
        level: "bad",
        title: "Look-alike site. Do not connect a wallet.",
        body: `${v.protocol} lists this address as a look-alike. The real site is ${v.official || "published in its registry"}.`,
      };
    case "tampered":
      return {
        level: "bad",
        title: `This ${v.protocol} page does not match what the protocol published.`,
        body: `${v.note.replace(/[.\s]*$/, ".")} Do not sign anything here. Use Evac to withdraw straight from the contracts.`,
      };
    case "alarm":
      return {
        level: v.status === "Compromised" ? "bad" : "warn",
        title: `${v.protocol} has raised an alarm (${v.status}).`,
        body: v.note || "Check the protocol's official channels before signing anything.",
      };
    default:
      return null;
  }
}

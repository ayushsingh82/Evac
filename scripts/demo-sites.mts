// Local pages for demoing the extension, with no deployed registry needed.
//   npm run extension && npx tsx scripts/demo-sites.mts
// It serves (Chrome resolves *.localhost by itself):
//   http://app.localhost:4600/                the "official" site, matches its published fingerprint
//   http://app.localhost:4600/tampered        the same site with a drainer script added
//   http://burrow-rewards.localhost:4600/     a listed look-alike
// and prints the demo data to paste into the extension's Settings.
import http from "node:http";
import { writeFileSync } from "node:fs";
import { fingerprintPage } from "../src/lib/sitecheck";

const PORT = Number(process.env.PORT ?? 4600);
const page = (title: string, extra = "", note = "") => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px/1.5 system-ui;background:#FBF6EF;color:#0D0D0C;margin:0;padding:64px 24px;text-align:center}
h1{font-size:44px;letter-spacing:-.03em;margin:0 0 8px}p{color:#5b5a54}button{font:600 16px system-ui;padding:14px 26px;border-radius:12px;border:0;background:#0D0D0C;color:#fff;margin-top:18px}</style></head>
<body><h1>${title}</h1><p>Lend and borrow on NEAR. (A demo page, not the real Burrow.)${note}</p><button>Connect wallet</button>
<script src="/app.js"></script><script>var cfg = { env: "demo" };</script>${extra}</body></html>`;

const GOOD = page("Burrow");
const BAD = page("Burrow", `<script src="http://cdn.drainer.localhost:${PORT}/connect.js"></script>`);
const LOOK = page("Burrow Rewards", "", " Claim your airdrop!");

const server = http.createServer((q, r) => {
  const host = (q.headers.host ?? "").split(":")[0];
  const u = q.url ?? "/";
  if (u === "/app.js") return r.end("console.log('burrow app')");
  if (u === "/connect.js") return r.end("/* drainer */");
  r.setHeader("content-type", "text/html");
  if (host.startsWith("burrow-rewards")) return r.end(LOOK);
  r.end(u === "/tampered" ? BAD : GOOD);
});
await new Promise<void>((ok) => server.listen(PORT, "127.0.0.1", ok));

const base = `http://app.localhost:${PORT}`;
const fp = await fingerprintPage(GOOD, base + "/", async (u) => (await fetch(u.replace("app.localhost", "127.0.0.1"))).text());
const demo = [
  {
    protocol: "burrow",
    entry: {
      release: "", manifest: "", url: base, site: JSON.stringify(fp), status: "Ok", status_note: "", status_at: 0,
      blocklist: ["burrow-rewards.localhost"], updated_at: 0,
    },
  },
];
writeFileSync("extension/demo-data.json", JSON.stringify(demo, null, 2));
console.log(`Demo pages are up on port ${PORT}.\n`);
console.log(`  clean       ${base}/`);
console.log(`  tampered    ${base}/tampered`);
console.log(`  look-alike  http://burrow-rewards.localhost:${PORT}/\n`);
console.log("Paste this into the extension Settings > Demo data (also saved to extension/demo-data.json):\n");
console.log(JSON.stringify(demo));

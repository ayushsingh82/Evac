// Watcher agent. Fingerprints a protocol's live website and compares it with the baseline in the registry.
//
//   npx tsx scripts/watcher.ts --registry evac-registry.near --protocol burrow          # check once, print verdict
//   npx tsx scripts/watcher.ts --url https://app.burrow.finance --baseline > site.json  # print a baseline to publish
//   ... --apply   (needs WATCHER_ACCOUNT and WATCHER_KEY) publishes Degraded/Compromised through set_status
//
// The watcher holds a function-call key that can only call set_status and set_blocklist on the registry.
import { loadTrustedManifest } from "../src/lib/registry";
import { compareFingerprint, decideStatus, fingerprintPage, parseFingerprint } from "../src/lib/sitecheck";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function get(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "user-agent": "evac-watcher/0.1" }, redirect: "follow" });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}

async function main() {
  const registry = arg("registry");
  const protocol = arg("protocol") ?? "burrow";
  let url = arg("url");
  let baseline = null;

  if (!flag("baseline")) {
    const t = await loadTrustedManifest(registry, protocol);
    if (!t.entry) throw new Error("No registry entry found; pass --registry and a registered --protocol.");
    url = url ?? t.entry.url;
    baseline = parseFingerprint(t.entry.site);
  }
  if (!url) throw new Error("Pass --url (or a registry entry that has one).");

  const html = await get(url);
  const fp = await fingerprintPage(html, url, get);

  if (flag("baseline")) {
    console.log(JSON.stringify(fp, null, 2));
    return;
  }

  const cmp = compareFingerprint(baseline, fp);
  const decision = decideStatus(cmp, fp);
  console.log(JSON.stringify({ url, verdict: cmp.verdict, ...decision, comparison: cmp }, null, 2));

  if (flag("apply") && decision.status !== "Ok") {
    const { Account, KeyPairSigner } = await import("near-api-js");
    const { JsonRpcProvider } = await import("@near-js/providers");
    const accountId = process.env.WATCHER_ACCOUNT;
    const key = process.env.WATCHER_KEY;
    if (!accountId || !key || !registry) throw new Error("--apply needs WATCHER_ACCOUNT, WATCHER_KEY and --registry.");
    const provider = new JsonRpcProvider({ url: "https://free.rpc.fastnear.com" });
    const account = new Account(accountId, provider, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
    const out = await account.callFunction({
      contractId: registry,
      methodName: "set_status",
      args: { protocol, status: decision.status, note: decision.note },
      gas: BigInt("30000000000000"),
      deposit: BigInt(0),
    });
    console.log("published", JSON.stringify(out));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

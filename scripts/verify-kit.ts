// Check a saved copy of the kit against the registry, from outside the browser.
//   npx tsx scripts/verify-kit.ts <registry-account> <protocol> [dir=out]
import { execFileSync } from "node:child_process";
import { loadTrustedManifest } from "../src/lib/registry";

async function main() {
  const [registry, protocol, dir = "out"] = process.argv.slice(2);
  if (!registry || !protocol) throw new Error("usage: verify-kit.ts <registry-account> <protocol> [dir]");
  const t = await loadTrustedManifest(registry, protocol);
  if (!t.entry) throw new Error("No registry entry found.");
  if (!t.entry.release) throw new Error("The registry has no release hash for this protocol yet.");
  try {
    const out = execFileSync("node", ["scripts/hash-out.mjs", "--dir", dir, "--check", t.entry.release], { encoding: "utf8" });
    console.log(out.trim());
  } catch (e) {
    console.log((e as { stdout?: string }).stdout?.trim() ?? "MISMATCH");
    process.exit(1);
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

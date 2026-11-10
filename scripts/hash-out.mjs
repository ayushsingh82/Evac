// Deterministic fingerprint of the built static app (./out). Publish this as the registry's `release` field.
//   npm run build && node scripts/hash-out.mjs            -> prints sha256:<hex> and the file count
//   node scripts/hash-out.mjs --check sha256:<hex>        -> exits 1 on mismatch
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.argv.includes("--dir") ? process.argv[process.argv.indexOf("--dir") + 1] : "out";

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root).sort();
const h = createHash("sha256");
for (const f of files) {
  const rel = relative(root, f).split("\\").join("/");
  h.update(`${rel}\0${createHash("sha256").update(readFileSync(f)).digest("hex")}\n`);
}
const digest = `sha256:${h.digest("hex")}`;

const i = process.argv.indexOf("--check");
if (i > -1) {
  const want = process.argv[i + 1];
  console.log(digest === want ? `MATCH ${digest}` : `MISMATCH\n  built:    ${digest}\n  expected: ${want}`);
  process.exit(digest === want ? 0 : 1);
}
console.log(digest);
console.error(`${files.length} files`);

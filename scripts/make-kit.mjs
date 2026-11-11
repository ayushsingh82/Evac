// Package the built app as a saveable kit:  npm run build && node scripts/make-kit.mjs
//   kit/evac-kit/app/        the static app (a copy of ./out)
//   kit/evac-kit/verify.mjs  stand-alone check, no install needed: node verify.mjs [expected-hash]
//   kit/evac-kit/SHA256      the kit's fingerprint
//   kit/evac-kit/README.txt  how to run it and check it
//   kit/evac-kit.tar.gz      the same folder as one file
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
function hashDir(root) {
  const h = createHash("sha256");
  for (const f of walk(root).sort()) {
    h.update(`${relative(root, f).split("\\").join("/")}\0${createHash("sha256").update(readFileSync(f)).digest("hex")}\n`);
  }
  return `sha256:${h.digest("hex")}`;
}

rmSync("kit", { recursive: true, force: true });
mkdirSync("kit/evac-kit", { recursive: true });
cpSync("out", "kit/evac-kit/app", { recursive: true });
const digest = hashDir("kit/evac-kit/app");
const files = walk("kit/evac-kit/app").length;
writeFileSync("kit/evac-kit/SHA256", digest + "\n");

writeFileSync("kit/evac-kit/verify.mjs", `// Stand-alone check of this kit. Needs only Node 18+.
//   node verify.mjs                 compare with the SHA256 file next to this script
//   node verify.mjs sha256:<hex>    compare with a hash you got from the protocol's registry or README
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const root = join(here, "app");
const h = createHash("sha256");
for (const f of walk(root).sort()) h.update(relative(root, f).split("\\\\").join("/") + "\\0" + createHash("sha256").update(readFileSync(f)).digest("hex") + "\\n");
const built = "sha256:" + h.digest("hex");
const want = process.argv[2] ?? readFileSync(join(here, "SHA256"), "utf8").trim();
console.log(built === want ? "MATCH " + built : "MISMATCH\\n  these files: " + built + "\\n  expected:    " + want);
process.exit(built === want ? 0 : 1);
`);

writeFileSync("kit/evac-kit/README.txt", `Evac exit kit
=============
A saved copy of Evac. Keep it somewhere safe. If the protocol's website is hijacked or gone, this still works,
because it talks only to NEAR and to your wallet.

1. Check it (do this on the day you save it, and again before you rely on it):
     node verify.mjs                          compares with the SHA256 file here
     node verify.mjs sha256:<hash>            compares with the hash published by the protocol (registry) or in the Evac README
   MATCH means these files are exactly the published build. MISMATCH means do not use them.

2. Run it:
     npx serve app          or:   python3 -m http.server --directory app 3000
   then open http://localhost:3000/dashboard (with python, use /dashboard.html)

3. Press Scan, review the plan, sign with your wallet.

Files: ${files}    Fingerprint: ${digest}
`);
execFileSync("tar", ["-czf", "kit/evac-kit.tar.gz", "-C", "kit", "evac-kit"]);
console.log(`kit/evac-kit.tar.gz  (${files} files)\n${digest}`);

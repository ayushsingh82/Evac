# Deploying Evac on NEAR mainnet

Nothing here has been run yet. Treat the commands as a checklist and read each tool's `--help` first; flag names vary by
`near-cli-rs` version. Use small amounts. Do the whole thing on testnet once if you can.

## 1. Accounts
- `evac-registry.<you>.near`: holds the registry contract.
- A DAO to own it: create a Sputnik DAO (or a Trezu treasury) with 2-of-3 signers, e.g. `evac-dao.sputnik-dao.near`.
- `evac-watcher.<you>.near`: the watcher agent's account (only needs gas money).

## 2. Build and deploy the registry
```bash
cd contracts/registry
cargo test                                              # 15 tests
cargo near build non-reproducible-wasm                  # or: cargo build --target wasm32-unknown-unknown --release
near contract deploy evac-registry.<you>.near use-file <path-to>.wasm \
  with-init-call new json-args '{"owner_id":"evac-dao.sputnik-dao.near"}' prepaid-gas '30 Tgas' attached-deposit '0 NEAR'
```
Toolchain note: the pinned `near-sdk = ~5.20` is the newest version that builds on rustc 1.91. Newer SDKs need rustc 1.95+.

## 3. Configure through DAO proposals (function calls on the registry)
1. `register_protocol {"protocol":"burrow","manifest":"<JSON from src/lib/manifest.ts>","url":"<the protocol's official site>"}`. Burrow's old domains (app.burrow.finance, burrow.finance) no longer resolve, so confirm the current official front end first
2. `set_site {"protocol":"burrow","site":"<output of: npx tsx scripts/watcher.ts --url <official site> --baseline>"}`
3. `grant_key {"public_key":"<watcher pubkey>","role":"Watcher","allowance_yocto":"1000000000000000000000000"}`
4. `grant_key {"public_key":"<website pubkey>","role":"Website","allowance_yocto":"..."}` (only for a real protocol team)
5. After the grants succeed, delete the registry account's own full-access key so only the DAO can act. This also freezes
   the contract's code. Do this last and only once everything works.

## 4. Publish the kit
```bash
NEXT_PUBLIC_REGISTRY_ID=evac-registry.<you>.near npm run build
node scripts/hash-out.mjs               # -> sha256:...  (reproducible)
```
DAO proposal: `set_release {"protocol":"burrow","release":"sha256:..."}`. Pin `out/` to IPFS and attach a zip to a GitHub
release. Anyone can then run `npx tsx scripts/verify-kit.ts evac-registry.<you>.near burrow out` and get MATCH/MISMATCH.

## 5. Run the watcher
```bash
WATCHER_ACCOUNT=evac-watcher.<you>.near WATCHER_KEY=ed25519:... \
  npx tsx scripts/watcher.ts --registry evac-registry.<you>.near --protocol burrow --apply
```
Run it from cron every few minutes. The watcher key can call only `set_status` and `set_blocklist`.

## Caveat about site fingerprints
Modern sites rename script files on every deploy. The watcher treats a new same-origin file as "Degraded: publish a new
fingerprint", and only raises `Compromised` for changed content behind the same address, a new inline script or a new
origin. A protocol that adopts Evac should publish a fresh fingerprint in its release process.

## Deploy the site on Vercel

The app is a static export, so Vercel just serves files. `vercel.json` already sets everything:

- install: `npm install` (`.npmrc` sets `legacy-peer-deps`, which the wallet libraries need)
- build: `next build && node scripts/make-kit.mjs` (the second step puts `evac-kit.tar.gz` into `out/download/` for the Download button)
- output directory: `out`, served as plain static files (framework "Other", so Vercel does not look for Next.js server files)
- `cleanUrls`: `/kit` serves `kit.html`, and so on

Steps: push the repo, then on vercel.com choose Add New Project, import `ayushsingh82/Evac`, keep the defaults, Deploy.
Optional environment variable: `NEXT_PUBLIC_REGISTRY_ID` (the registry account) once the registry is deployed.

Checked in a clean copy with no `node_modules`: install, build, the `/kit` page and its download, and the kit's hash matching the
deployed site's hash all pass. Not checked: an actual Vercel deployment, which needs your Vercel account.

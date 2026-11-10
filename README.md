# Evac

**A fire exit for NEAR DeFi.** When a protocol's website is down or hijacked, your funds are still in its contracts.
Evac reads your position straight from the contracts, builds the withdrawal on your machine, refuses anything that is
not a plain withdrawal to you, and tells you honestly whether the money really came back.

Built for the NEAR Hackathon. Tracks: Unstoppable DeFi, AI Security & Defense, Open Innovation.
Design notes: [docs/architecture.md](docs/architecture.md) (the original plan; this README says what was actually built).

## What it does

1. **Scan.** Reads your Burrow lending position (`contract.main.burrow.near`, Burrow's live mainnet contract) from three
   NEAR RPC providers at one pinned block. One dead provider is tolerated; providers that disagree stop the read.
2. **Plan.** Builds one `execute` call: free collateral, then withdraw everything. If you have a loan it builds a partial
   exit (non-collateral deposits only) and explains why.
3. **Guard.** The **Exit Guard** checks the exact transaction before the wallet sees it. It refuses `AddKey`, `Transfer`,
   `DeleteAccount`, unknown contracts or methods, any deposit other than exactly 1 yoctoNEAR, extra fields, and anything it
   cannot decode. There is no override. A 21-payload attack corpus is in the tests.
4. **Sign.** NEAR wallet-selector (MyNearWallet, Meteor, HOT). The wallet receives a frozen copy of what the Guard approved.
5. **Verify.** "Recovered" shows only if **every receipt** in the transaction succeeded **and** each token balance rose.
   (On NEAR the first receipt can succeed while the token transfer fails and the protocol refunds the deposit.)
6. **Bridge out (optional).** Send what you recovered to USDC on Base/Ethereum/Arbitrum/Solana through NEAR Intents' 1Click
   API. A separate Bridge Guard accepts only the exact quoted transfer to the quoted deposit address.
7. **Registry.** A Rust contract holds, per protocol, the kit hash, the exit manifest, the site fingerprint, an alarm status
   and a blocklist. The owner is a DAO. The website key can call `set_url` only; the watcher key can call `set_status` and
   `set_blocklist` only. These are NEAR function-call access keys, so the protocol itself stops them from doing anything else.
8. **Watcher.** `scripts/watcher.ts` fingerprints the live site (hash of every script) and compares it with the registry.
   A changed script behind the same address, a new inline script or a script from a new origin raises `Compromised`.
9. **Hijack check.** Paste any transaction from a site you do not trust; Evac says whether it is a safe exit.

No server of ours is in the path: the app is a static export, and the build is reproducible
(`npm run build && node scripts/hash-out.mjs` gives the same hash every time).

## Status

| Piece | State |
|---|---|
| RPC quorum at a pinned block | done, tested, run against mainnet |
| Burrow scan + exit plan | done; live scan of a real account works |
| Exit Guard + attack corpus | done (21 payloads refused, real exit accepted) |
| Wallet signing (`wallet-selector`) | done; **not yet tried with a real wallet** |
| Receipt + balance "Recovered" check | done, tested on fixtures; **not yet run on a real exit** |
| Registry contract (Rust) | done, 15 unit tests, wasm builds; **not deployed** |
| Registry client + manifest comparison | done, tested with fakes; needs a deployed registry to run for real |
| Watcher | done; fingerprinting tested against a real DeFi site (app.rhea.finance, used only as a test target); publishing needs a deployed registry |
| 1Click bridge-out + Bridge Guard | done; dry quote verified live; **real bridge not run** |
| Storage-registration pre-check | done, tested |
| Reproducible build + hash tools | done |

**Not verified on mainnet:** a real withdrawal. The live Burrow contract differs from its archived source (it now has Pyth
price paths), so the first real exit with a small position is the key test. With an open loan, Burrow may ask for a price
check even on a plain withdraw; in that case the transaction fails safely and the Recovered check says so.

## Run

```bash
npm install --legacy-peer-deps
npm test                                          # 88 TypeScript tests
(cd contracts/registry && cargo test)             # 15 contract tests
npx tsx scripts/scan.ts <account.near>            # live scan + guarded plan from the terminal
npx tsx scripts/watcher.ts --url https://app.rhea.finance --baseline    # example: print a site fingerprint
npm run dev                                       # the app
npm run build && node scripts/hash-out.mjs        # static export + its hash
```

Deploying the registry, DAO and watcher: [DEPLOY.md](DEPLOY.md). Demo script: [DEMO.md](DEMO.md).
Submission text: [SUBMISSION.md](SUBMISSION.md).

## Layout

```
src/lib/        rpc (quorum) · burrow (scan, plan) · guard · wallet · verify · registry · sitecheck · intents · storage
src/app/        the static web app
scripts/        scan · watcher · verify-kit · hash-out
contracts/registry/   Rust registry contract (near-sdk 5.20)
test/           88 tests: quorum, guard, plan, verify, registry, sitecheck, intents, hijack corpus
```

## Design credit

The idea and structure come from the authors' earlier ETHGlobal Mumbai entry (an exit kit rooted in an ENS name). This
repository is a new implementation for NEAR: the registry contract, function-call-key permissions, the NEAR Exit Guard,
the asynchronous-receipt check, the Burrow adapter and the 1Click bridge are all new code.

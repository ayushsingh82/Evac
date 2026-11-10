# CopeyBara on NEAR: architecture and build plan

A fire exit for DeFi. When a protocol's website is down or hijacked, CopeyBara reads your positions straight from the NEAR contracts and builds the withdraw transactions locally, so your money can get out without trusting the frontend.

Hackathon: development ends **14 Nov 2026, 23:59 UTC**. Today is 9 Nov, so there are about 5 days.
Tracks to tag: **Unstoppable DeFi (DFI)**, **AI Security & Defense (SEC)**, **Open Innovation (NEW)**.

Legend: **[V]** = verified from the source I read. **[U]** = unverified, check in the first 2 hours (see the checklist).

---

## 1. What we build

1. **Scan.** Enter a NEAR account (or connect a wallet). CopeyBara reads supplied, collateral and borrowed positions on supported protocols directly from contract view methods. No indexer, no protocol website.
2. **Plan.** It builds an *exit plan*: the exact ordered contract calls to get everything out (repay debt if needed, decrease collateral, withdraw). It shows health factor before and after.
3. **Verify.** Every transaction is decoded into plain words and checked against a hard-coded allowlist of canonical contract ids. "This will call `execute` on contract X to withdraw 12 USDC to you."
4. **Exit.** Sign with your wallet. Optional last step: send the funds to another chain through NEAR Intents (1Click).
5. **Run anywhere.** Ship it as a single static page that works offline from IPFS or a local file, plus an `npx` CLI, so it still works when the main site is gone.

Differentiator, the **hijack check**: paste or scan the transaction an untrusted site is asking you to sign, and CopeyBara tells you whether it matches the plan it would have built itself. This turns the exit tool into a security tool (SEC track).

## 1b. Port map from the ETHGlobal Mumbai version (reference repo, updated after reading it)

Reference: `github.com/Harman206/HACKETH-MUMBAI` (MIT). It is a pnpm monorepo with `packages/{core,guard,quorum,ens,sitecheck,adapters,exec,protocol-cli,fingerprint,widget}`, `apps/{kit,extension,watcher,site}`, Foundry contracts and a "replay" suite. Its trust root is an **ENSv2 name**. NEAR has no ENS, so the root of trust becomes a **NEAR account plus a small registry contract**, and that is where NEAR's own strengths show up.

> **Eligibility warning.** The repo was created 5 Nov and was built for ETHGlobal Mumbai. The NEAR rules count code written since the announcement, but you should (a) check HACKATHON.md and the ETHGlobal rules for anything about entering the same project in two events, (b) make the NEAR version a **new repo or clearly separate directory with new commits**, and (c) say in the README that the design comes from your ETHGlobal entry. Only port code you or your teammates wrote; the repo is MIT licensed, so keep its license notice if you copy any file.

| ETHGlobal version | NEAR version | Effort |
|---|---|---|
| **ENSv2 name = security root**, records `org.copeybara.{release,manifest,exits,site,extension,status,blocklist}` | **`copeybara-registry` contract** (Rust), one entry per protocol: the same seven fields, stored on chain and read by view call | Medium |
| **2-of-3 Safe** owns the name | **Sputnik DAO / Trezu** (hackathon ecosystem tools) owns the registry entry; changes need 2-of-3 votes | Low–medium |
| **PermissionedResolver + Enhanced Access Control**: website key may write `url` only, watcher key `status` + `blocklist` only; a stolen key's other writes revert | **Function-call access keys**, NEAR's native feature: website key limited to method `set_site_url`, watcher key limited to `set_status` and `set_blocklist`, each with a gas allowance. Other methods are impossible by protocol rules, not just by contract checks. Matches the **FUNCTION CALL KEYS** tag on the SEC track | Low (the feature is built in) |
| **Watcher agent with its own ENSv2 subname** (`watcher.demoswap-blackout.eth`), Safe can revoke in one tx | Watcher runs as **`watcher.<protocol>.near`**, a sub-account whose only key is the limited function-call key above; the DAO revokes it with `DeleteKey`. Optional: run it in a TEE (OutLayer / NEAR AI Cloud) and publish the attestation [U] | Medium |
| **3-RPC quorum at one pinned block** (`packages/quorum`) | Same idea. NEAR RPC `query` accepts a `block_id`; read at one pinned block height from 3 providers (FastNEAR, public mainnet RPC, one more [U]). Require 2 of 3 to agree | Low–medium |
| **Exit Guard** (`packages/guard`): target in manifest, allowlisted selectors even inside multicalls, payouts only to user, `value` 0, no approvals/permits/transfers, decode failure = reject | **NEAR Exit Guard**: `receiver_id` in manifest; `FunctionCall` method allowlisted; args decoded, including nested `msg` strings (`Execute` actions); deposit is 0 or exactly 1 yocto; recipient equals the signer; reject `AddKey`, `DeleteKey`, `DeployContract`, `Transfer`, `Stake`, `ft_transfer`/`ft_transfer_call` to anyone off the manifest. **`AddKey` is the NEAR-specific drainer move** (a hijacked site adds itself a full-access key), so rejecting it by default is the headline safety rule | Medium: reuse the structure and the property-test approach, rewrite the decoders |
| `exec.runExit`: Guard → simulate → send → receipt → per-token balance delta | Same, but **NEAR receipts are asynchronous**: a transaction can succeed while a callback receipt fails. "Recovered" must check *every* receipt outcome in the transaction (`EXPERIMENTAL_tx_status` or `tx` with `FINAL` wait) **and** a positive `ft_balance_of` delta | Medium (this is the NEAR gotcha) |
| `adapters`: Uniswap v3/v4, Aave v3, Curve 3pool | **Burrow/Rhea lending** (main), plus one of Ref LP / liquid staking / Intents balances. See section 3 | High: all new |
| **Declarative exits** (`org.copeybara.exits`): a vault described only by a record is recovered with no new code | Port as the registry's `exits` field: `{find: view call + args, exit: method + args template}`. Great for the demo: add a protocol by writing a record | Medium |
| **Kit**: Vite + Preact single HTML file, sha256 in ENS, `verify-kit.sh` | Same build. `scripts/verify-kit.sh kit.html protocol.near` calls `near view copeybara-registry.near get_entry` and compares sha256 | Low (reuse build and repro checks) |
| **Browser extension** (MV3): blocks drainer approvals, checks site scripts vs fingerprint | **Cut for the hackathon.** NEAR wallets inject differently and it is a big surface. Keep `sitecheck` fingerprinting for the watcher only. Mention as roadmap | Cut |
| **Site fingerprint + watcher raises alarm** (`status`: ok/degraded/compromised) | Keep: watcher fetches the site, hashes scripts, compares with the `site` field, calls `set_status` on the registry | Medium |
| **Fire Drill**: switch off site, DNS, primary RPC, exits still land | Keep as the demo's centerpiece. Use a hosts-file block plus an RPC failover test | Low–medium |
| **Replay of the Curve 2022 hijack** on a mainnet fork | Replace with a **scripted hijack**: a fake frontend that asks to `AddKey` or send funds to another account. The Guard rejects it. If you can find a real NEAR frontend-hijack incident, cite it [U]; otherwise say "simulated" | Low |
| Benchmarks (696/697 drainer requests, 14k domains) | Not portable. Replace with your own small, honest numbers (tests passing, attack payloads rejected) | Low |

What to say in the pitch: "NEAR gives us the pieces ENS needed a whole permission contract for. A function-call key can do one thing on one contract, which is exactly the least privilege a website key or a watcher agent should have."

## 2. System diagram

```
 ┌──────────────────────────────────────────────────────────────────┐
 │  CopeyBara client  (static, no backend; also usable as a CLI)    │
 │                                                                  │
 │  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
 │  │ Scanner   │→ │ Exit       │→ │ Verifier / │→ │ Signer      │  │
 │  │ views via │  │ Planner    │  │ Decoder    │  │ wallet-     │  │
 │  │ RPC       │  │ (per       │  │ allowlist, │  │ selector or │  │
 │  │           │  │ protocol   │  │ simulate   │  │ local key   │  │
 │  │           │  │ adapters)  │  │            │  │ (CLI)       │  │
 │  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘  │
 │        │              │               │                │         │
 │        ▼              ▼               ▼                ▼         │
 │   ┌─────────────────────────────────────────────────────────┐    │
 │   │ Protocol adapters: Burrow/Rhea lending, + one more      │    │
 │   └─────────────────────────────────────────────────────────┘    │
 │        │                                       │                 │
 │        ▼                                       ▼                 │
 │   NEAR RPC (3 endpoints, failover)      1Click API (optional     │
 │                                         cross-chain exit)        │
 └──────────────────────────────────────────────────────────────────┘
         ▲
         │ same code, three delivery forms
 IPFS static bundle · GitHub release (single HTML) · npx copeybara
```

No server of ours sits in the path. That is the point. If we host a backend, we become the website that can go down.

## 3. Protocol adapters

An adapter has the same interface for every protocol:

```ts
interface Adapter {
  id: string;                         // "burrow"
  contractIds: string[];              // canonical ids, hard-coded
  scan(account: string): Promise<Position[]>;
  plan(positions: Position[], opts): Promise<ExitPlan>;   // ordered tx actions
  decode(action): HumanReadable;      // used by the verifier
}
```

### 3.1 Burrow / Rhea lending (main adapter)

Facts from the Burrow source (`NearDeFi/burrowland`, README and contract files):

- **Withdraw** [V, archived snapshot]: `execute(actions)` is `#[payable]` and needs **exactly 1 yoctoNEAR**. Action shape: `{"Withdraw":{"token_id":"<ft contract>","amount":"<optional>","max_amount":"<optional>"}}`. If both amounts are omitted, the maximum available is used. Withdrawing takes only from *supplied* (non-collateral) balances, needs **no oracle prices**, and a failed token transfer re-credits the balance via a callback.
- **Collateral** [V]: to withdraw collateral you first run `DecreaseCollateral` (same amount shape). With **no borrows**, no prices are needed, so `execute` works. With **any borrow**, it needs oracle prices and must go through the price oracle's `oracle_call` with `msg = {"Execute":{"actions":[...]}}`; a plain `execute` panics.
- **Repay** [V]: `Repay` needs no oracle. Do it with `execute` (from your supplied balance) or by `ft_transfer_call` of the debt token with `msg = {"Execute":{"actions":[{"Repay":{"token_id":"..."}}]}}`.
- **Views** [V]: `get_account(account_id)` returns supplied, collateral, borrowed (each `{token_id, balance, shares, apr}`), `get_assets_paged_detailed`, `get_config` (includes `oracle_account_id`). Careful: pagination `limit` behaves like an end index in `get_assets_paged`; test on chain.
- **No health-factor view** [V]: compute it yourself from collateral, borrowed, prices and asset config (`volatility_ratio` and similar from `get_asset`).
- **Storage**: the account must already be registered with the protocol (`storage_deposit`) [V]. The exit path only handles existing positions, so this is fine.
- **Gas**: README examples use 200 TGas for `execute` [V]. Oracle paths need more testing [U].

**Not verified, and important:**
- The repo is **archived (since Jan 2023)**, so the live mainnet contract may differ. [U]
- The **mainnet contract id** (a Flipside dashboard and explorer pages point to `contract.main.burrow.near`) and the **mainnet oracle id** [U]. Confirm with `near view contract.main.burrow.near get_config '{}'` before trusting anything.
- **Rhea Finance's lending contract** [U]. Rhea absorbed or rebranded parts of the NEAR DeFi stack; find its lending contract id and ABI (`rhea.finance` docs / GitHub org) and confirm whether it is the same code as Burrow.

If Rhea lending is a rebrand of Burrow, one adapter covers both and you can honestly say "Burrow and Rhea."

### 3.2 Second adapter: pick ONE after the checklist

- **Ref / Rhea DEX LP**: `remove_liquidity` on the exchange contract, then `withdraw` of the internal balances. Two-step (remove, then withdraw). Contract ids [U].
- **Liquid staking (Meta Pool / similar)**: unstake then withdraw after the epoch delay. Contract ids [U].
- **Intents balances**: withdraw from the verifier contract using a signed intent. Docs exist at docs.near-intents.org (verifier contract, withdrawals). Useful because it shows the exit path across chains.

Choose whichever has the simplest, best-documented withdraw. Do not start a third adapter.

### 3.3 Optional last hop: bridge out via 1Click

After withdrawing to the user's NEAR account, `POST /v0/quote` [V] with `originAsset` = the withdrawn token, `destinationAsset` = USDC on another chain, `recipient` = the user's address there, `recipientType: DESTINATION_CHAIN`, `refundTo` = the NEAR account. Send the tokens to the returned `depositAddress`, then poll `GET /v0/status` [V]. API key recommended (without one, an extra 0.25% fee applies) [V].

## 4. Exit planner logic

```
positions = scan(account)

if no borrows:
    for each collateral asset:  DecreaseCollateral(max)       # no oracle
    for each supplied asset:    Withdraw(max)                 # one execute call
    → single execute([...]) with 1 yocto, per protocol

if borrows:
    option A (preferred when possible):
        Repay debts using supplied balances        # no oracle
        then as above
    option B (needs oracle):
        oracle_call(asset_ids, msg=Execute[DecreaseCollateral, Withdraw])
        simulate health factor first; refuse if result < safety margin (e.g. 1.3)
    if neither is possible:
        show "partial exit": withdraw the maximum safe amount

then optional: 1Click quote → bridge out
```

Rules the planner enforces:
- Never exceed the safe amount unless the user explicitly picks "risky exit" and sees the liquidation warning.
- Use `max_amount` (not `amount`) when balances may change between plan and signing.
- Re-read views right before signing; abort if positions changed by more than a tolerance.
- Each plan step carries a plain-English description used by the verifier.

## 5. Verifier and hijack check (the security feature)

Input: any transaction (or a list of actions) from an untrusted source, either pasted base64 / JSON, or the plan we built ourselves.

Checks:
1. `receiver_id` is on the canonical allowlist for that protocol (hard-coded in the bundle and cross-checked against the on-chain registry below).
2. Method is expected (`execute`, `oracle_call`, `ft_transfer_call`, `storage_deposit`). Flag everything else.
3. Decode args. Flag `ft_transfer`/`ft_transfer_call` to unknown receivers, `AddKey`/`FullAccessKey` actions, `DeleteKey`, `DeployContract`, `Transfer` of NEAR to unknown accounts. These are what a hijacked frontend would try.
4. Compare against our own plan: "The site asks to withdraw 10 USDC to you. We would have built the same. ✓" or "This sends your USDC to `evil.near`. ✗".
5. Simulate via RPC (view the account before, estimate after) where possible.

**Registry (now core, see section 1b):** the `copeybara-registry` contract stores each protocol's release hash, manifest (canonical contract ids and allowed methods), exits, site fingerprint, status and blocklist. Owner is a Sputnik DAO; the website key and watcher key are limited function-call keys. The client ships with a hard-coded copy of the demo protocol's manifest and warns if the on-chain registry differs. If time runs out, fall back to the hard-coded list for the demo and say so.

## 6. Delivery forms (what makes it a "fire exit")

| Form | How | Why |
|---|---|---|
| Static bundle | `vite build` to one folder; pin on IPFS; also publish via `*.near.page` / web4 if easy [U] | Works with no server of ours |
| Single HTML file | Inline everything; attach to a GitHub release | Open from disk, offline; works even if all domains are down |
| CLI | `npx copeybara scan <account>` / `plan` / `exit` using a local key file or `near-cli` credentials | For power users and agents |
| RPC failover | List of 3+ endpoints (mainnet RPC, FastNEAR, others [U]); try in order | The chain's RPC can also be flaky |

Wallet signing: `@near-wallet-selector` with a couple of wallets [U which are healthy now], plus "import private key (local only)" in the CLI. Never send keys anywhere.

## 7. Tech stack

TypeScript everywhere. `near-api-js` / `@near-js/*` for RPC and transactions, `@near-wallet-selector/*` for browser signing, Vite for the static bundle, Vitest for tests, `commander` for the CLI. Optional Rust or `near-sdk-js` for the registry contract. No backend. You can copy the Next.js/TypeScript project hygiene (lint, Playwright) from `snipe-proof-meme-launch/`, but a Vite static app is the better base for this one.

## 8. First-2-hours verification checklist (before any feature work)

1. `near view contract.main.burrow.near get_config '{}'` (or via RPC `query` call). Confirm it exists and note `oracle_account_id`.
2. Find Rhea's current lending contract and whether it matches Burrow's `execute` ABI. Read its GitHub/docs.
3. Create a **mainnet test position**: supply ~$5 of USDC/NEAR on the real protocol using its normal website.
4. From the CLI, call `get_account` for that account and print supplied / collateral / borrowed.
5. Hand-build one `execute` with `Withdraw` (and `DecreaseCollateral` if you set collateral) with 1 yocto and run it. Does the money come out? How much gas?
6. Make a small borrow, then try the oracle path (`oracle_call` with `Execute` actions). Record the exact message and gas.
7. Pick the second adapter by which has the cleanest withdraw. Test it by hand the same way.
8. Apply for a 1Click API key (partners.near-intents.org) for the optional bridge step.

If step 5 fails and cannot be fixed in 3 hours, switch to Moi (see `moi-architecture.md`).

## 9. Build plan (9–14 Nov)

| Day | Goal | Done when |
|---|---|---|
| **Mon 9 Nov** | Checklist above. Repo, Vite + TS scaffold, RPC client with failover | A real position of yours is read by a script, and one hand-built withdraw succeeded on mainnet |
| **Tue 10 Nov** | Burrow/Rhea adapter: `scan`, `plan` (no-borrow case), `decode` | CLI `plan` prints the correct exit for your test account |
| **Wed 11 Nov** | Borrow case (repay or oracle path), health-factor math, second adapter | Exit works for an account with a small loan on a real or fork-like test |
| **Thu 12 Nov** | Web UI: scan, plan, decode, sign via wallet selector; verifier / hijack check; single-HTML build | Full exit of a test account from the static page |
| **Fri 13 Nov** | 1Click bridge-out step (if time), tests, README, architecture diagram, record demo | Demo recorded; repo public |
| **Sat 14 Nov** | IPFS pin + GitHub release, post on X, submit well before 23:59 UTC | Submission confirmation received |

Cut order if behind: 1Click bridge → watcher agent → second adapter → borrow-case oracle path (document it as "supported for no-debt accounts, debt accounts get a safe partial exit"). Keep the registry, the Guard and the Fire Drill; they are the story. The browser extension is already cut.

Realistic warning: this port is bigger than Moi's. The adapters, registry, Guard decoders and async-receipt checks are all new, and the reference repo's 917 tests will not carry over. If by the end of Tuesday the no-borrow exit does not work on mainnet, switch to Moi.

## 10. Demo plan (90 seconds)

1. **0:00** "Your DeFi site just went down. Or worse, got hijacked."
2. **0:08** Show the protocol's real website with your test position. Then block it: edit `/etc/hosts` or use DevTools to block the domain. The page fails to load.
3. **0:20** Open CopeyBara from a local file (airplane-mode style, only RPC needed). Enter your account. It shows supplied / collateral / borrowed and health factor.
4. **0:35** Click **Plan exit**. Show the readable plan: "Decrease collateral 5 USDC → Withdraw 5 USDC" with the contract id highlighted against the allowlist.
5. **0:50** Sign. The balance appears in the wallet. Show the explorer link.
6. **1:00** **Hijack check:** paste a malicious transaction (a prepared one that adds a full-access key or sends USDC to another account). CopeyBara flags it in red with the reason.
7. **1:15** Optional: bridge to USDC on Base through 1Click. Show `SUCCESS`.
8. **1:25** Show the three delivery forms (IPFS link, single HTML, `npx`). End on the repo link.

Tips: record at a normal pace, show real transaction hashes, keep the "site is down" moment real (hosts-file block, not a mock), and keep every number on screen readable.

Post on X: video, one sentence on the problem (frontends are the weak point of "decentralized" DeFi), one on how it works (reads contracts directly, builds and verifies transactions locally, optional Intents exit), tag @NEARProtocol and #NEARHackathon, say "built at NEAR HACKATHON".

## 11. Submission copy (draft, 20–2,000 characters)

> CopeyBara is a fire exit for NEAR DeFi. When a protocol's website is down or hijacked, it reads your lending positions straight from the contracts, builds the exact withdraw transactions locally, decodes them into plain language, checks them against a canonical contract allowlist, and lets you sign with your own wallet. It also checks any transaction an untrusted site asks you to sign against the plan it would have built itself, catching swapped recipients and added access keys. It ships as a static bundle for IPFS, a single offline HTML file, and an npx CLI, so there is no server of ours to take down. An optional last step uses NEAR Intents' 1Click API to send the funds to another chain. Built for the Unstoppable DeFi and AI Security & Defense tracks.

Edit it to match what is actually built. Do not claim protocols you did not test.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Burrow repo is archived; mainnet may differ | Wrong ABI | Checklist steps 1, 5, 6 on mainnet before writing code |
| Rhea contract unknown | Can't claim Rhea | Claim only what you tested |
| Oracle path complexity (debt accounts) | Hardest feature | Ship no-debt exit first; debt accounts get repay-from-supply or a safe partial exit |
| Wallet selector wallet outages | Can't sign in demo | Also support local-key signing; have a backup wallet |
| Pagination and view quirks | Wrong data | Test views on chain; avoid paged calls where `get_account` suffices |
| Real money in tests | Loss | $5–10 positions, separate test account |
| "Needs no server" can't also use a registry contract | Slight contradiction | Registry is optional and read-only; the bundle works without it |

## 13. What I need from you

- A NEAR mainnet account with ~$20 total: a few dollars of a supported asset to supply, a little NEAR for gas, and a tiny borrow for the debt test.
- Which wallet you use (so I test the right one in the wallet selector).
- A 1Click API key (apply today) if you want the bridge-out step.
- Your NEAR wallet address for the submission form and your team size.
- A domain (optional) or just the IPFS and GitHub release links.

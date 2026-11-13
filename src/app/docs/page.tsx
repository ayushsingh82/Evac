import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter, SiteNav } from "../chrome";
import { Code, DocsShell, type TocGroup } from "../DocsKit";

export const metadata = { title: "Docs · Evac" };

const TOC: TocGroup[] = [
  { title: "Getting started", items: [{ id: "quickstart", label: "Quick start" }, { id: "how", label: "How an exit works" }] },
  { title: "Concepts", items: [{ id: "architecture", label: "Architecture" }, { id: "guard", label: "The Exit Guard" }] },
  {
    title: "Tools",
    items: [
      { id: "kit", label: "Save the kit" },
      { id: "extension", label: "Browser extension" },
      { id: "bridge", label: "Bridge out" },
    ],
  },
  {
    title: "Operate",
    items: [
      { id: "verify", label: "Verify the kit" },
      { id: "registry", label: "Registry and keys" },
      { id: "watcher", label: "The watcher" },
    ],
  },
  { title: "Help", items: [{ id: "trouble", label: "Troubleshooting" }, { id: "limits", label: "Limits" }, { id: "glossary", label: "Glossary" }] },
];

const REFUSED: [string, string][] = [
  ["AddKey", "Adds an access key to your account. This is the classic takeover move."],
  ["DeleteKey / DeleteAccount", "Locks you out, or deletes the account and sends what is left elsewhere."],
  ["Transfer", "Sends NEAR out of your account."],
  ["DeployContract / CreateAccount / Stake", "Not part of a withdrawal."],
  ["Unknown contract", "Anything not on the exit list, including look-alike names such as contract.main.burrow.near.evil.near."],
  ["Unknown or undecodable method", "A method that isn't allowed, or has no safe decoder, is refused even if a list names it."],
  ["Deposit other than exactly 1 yoctoNEAR", "Burrow's execute needs exactly 1 yocto. Anything else could move NEAR."],
  ["Borrow, Liquidate, ForceClose, IncreaseCollateral", "Burrow actions that aren't withdrawals."],
  ["Extra fields, bad amounts, empty actions", "Anything outside the exact expected shape."],
  ["Wrong signer", "A transaction signed by an account other than the one you connected."],
];

const ROLES: [string, string, string][] = [
  ["Owner (a DAO)", "Everything", "Registers protocols, sets the release, manifest and site fingerprint, grants and revokes keys."],
  ["Website key", "set_url", "Can update the official site address. Nothing else."],
  ["Watcher key", "set_status, set_blocklist", "Can raise the alarm and update the look-alike blocklist. Nothing else."],
];

const ALARMS: [string, string, string][] = [
  ["Compromised", "Same address, different content; a new inline script; a script from a new origin", "A hijack looks like this. Treat the site as unsafe."],
  ["Degraded", "A new same-origin file, or an expected file missing", "Usually a normal redeploy. The protocol should publish a fresh fingerprint."],
  ["Ok", "Everything matches the published fingerprint", "Nothing changed."],
];

const GLOSSARY: [string, string][] = [
  ["Exit Guard", "The check that every transaction must pass before your wallet sees it. It fails closed."],
  ["Quorum", "Four independent RPC providers answer the same read at one pinned block. At least two must answer, and every answer must match."],
  ["Receipt", "NEAR runs a transaction as a chain of steps called receipts. Any later one can fail even if the first succeeds."],
  ["Function-call key", "A NEAR access key limited to specific methods on one contract."],
  ["Manifest", "The list of contracts and methods a withdrawal may touch."],
  ["yoctoNEAR", "The smallest unit of NEAR. Burrow's execute needs exactly 1."],
  ["Pinned block", "One block height every read in a scan is made at, so answers can be compared."],
];

export default function Docs() {
  const sections: Record<string, ReactNode> = {
    quickstart: (
      <>
          <h2 id="quickstart">Quick start</h2>
          <div className="steps3">
            <div className="stepc"><b>1</b><h3>Open Evac</h3><p>Go to the dashboard. No account, no install.</p></div>
            <div className="stepc"><b>2</b><h3>Scan</h3><p>Enter your NEAR account. Evac reads your Burrow position and builds the exit plan.</p></div>
            <div className="stepc"><b>3</b><h3>Sign</h3><p>Connect your wallet and sign. Evac confirms the money actually came back.</p></div>
          </div>
          <p>
            <Link href="/dashboard" className="btn2">Open Evac</Link>
          </p>
          <p>Or from a terminal:</p>
          <Code>{`npm install --legacy-peer-deps
npx tsx scripts/scan.ts your-account.near`}</Code>
      </>
    ),
    how: (
      <>
          <h2 id="how">How an exit works</h2>
          <ol className="flow">
            <li><b>Scan.</b> Four independent NEAR RPC providers answer the same read at one pinned block. They must agree, or Evac stops. One that is down is tolerated.</li>
            <li><b>Plan.</b> With no debt, one <code>execute</code> call frees collateral and withdraws everything. With debt, a partial exit of non-collateral deposits.</li>
            <li><b>Guard.</b> The exact transaction is checked before your wallet sees it. The wallet receives a frozen copy of what the Guard approved.</li>
            <li><b>Sign.</b> Through NEAR wallet-selector (MyNearWallet, Meteor, HOT).</li>
            <li><b>Verify.</b> Every receipt must succeed and each withdrawn token balance must rise. Only then does Evac say Recovered.</li>
            <li><b>Bridge out (optional).</b> Send what you recovered to USDC on another chain through NEAR Intents.</li>
          </ol>
      </>
    ),
    architecture: (
      <>
          <h2 id="architecture">Architecture</h2>
          <div className="arch" role="img" aria-label="Architecture: browser app reads from four RPC providers, builds a plan, runs the Exit Guard, then the wallet signs.">
            <div className="arch-col">
              <div className="arch-box"><b>Evac app</b><span>static files, runs in your browser</span></div>
            </div>
            <div className="arch-arrow">→</div>
            <div className="arch-col">
              <div className="arch-box"><b>4 NEAR RPC providers</b><span>must agree at one block</span></div>
              <div className="arch-box"><b>Registry contract</b><span>exit list, kit hash, alarm</span></div>
            </div>
            <div className="arch-arrow">→</div>
            <div className="arch-col">
              <div className="arch-box hot"><b>Exit Guard</b><span>fail-closed, no override</span></div>
            </div>
            <div className="arch-arrow">→</div>
            <div className="arch-col">
              <div className="arch-box"><b>Your wallet</b><span>you sign</span></div>
              <div className="arch-box"><b>Burrow contract</b><span>funds return to you</span></div>
            </div>
          </div>
          <p className="fine">There is no Evac server anywhere on this path. The optional bridge step talks to NEAR Intents&apos; public 1Click API.</p>
      </>
    ),
    guard: (
      <>
          <h2 id="guard">The Exit Guard</h2>
          <p>Every transaction must pass. If the Guard can&apos;t decode something, it refuses. There is no override button.</p>
          <div className="table">
            <div className="trow thead"><span>It refuses</span><span>Why</span></div>
            {REFUSED.map(([a, b]) => (
              <div className="trow" key={a}>
                <span><code>{a}</code></span>
                <span>{b}</span>
              </div>
            ))}
          </div>
          <p>What a safe withdrawal looks like, and what a hijacked site might send instead:</p>
          <div className="duo2">
            <Code label="accepted">{`{
  "receiverId": "contract.main.burrow.near",
  "actions": [{
    "type": "FunctionCall",
    "methodName": "execute",
    "args": { "actions": [
      { "Withdraw": { "token_id": "wrap.near" } }
    ]},
    "deposit": "1"
  }]
}`}</Code>
            <Code label="refused">{`{
  "receiverId": "you.near",
  "actions": [{
    "type": "AddKey",
    "publicKey": "ed25519:attacker",
    "accessKey": { "permission": "FullAccess" }
  }]
}`}</Code>
          </div>
          <p>The test suite includes 21 realistic attack payloads, all refused.</p>
      </>
    ),
    verify: (
      <>
          <h2 id="verify">Verify the kit</h2>
          <p>The build is reproducible, so its hash can be published and checked from outside the browser.</p>
          <Code>{`npm run build
node scripts/hash-out.mjs                           # prints sha256:...
npx tsx scripts/verify-kit.ts <registry> burrow out   # MATCH or MISMATCH`}</Code>
      </>
    ),
    registry: (
      <>
          <h2 id="registry">Registry and keys</h2>
          <p>
            A Rust contract holds, per protocol, the kit hash, the exit manifest, the site fingerprint, an alarm status and a
            blocklist. A DAO owns it. The two limited keys are NEAR function-call access keys, so the protocol itself stops them from
            doing anything else, and the contract checks the role a second time.
          </p>
          <div className="table">
            <div className="trow thead three"><span>Who</span><span>Can call</span><span>Purpose</span></div>
            {ROLES.map(([a, b, c]) => (
              <div className="trow three" key={a}>
                <span><b>{a}</b></span>
                <span><code>{b}</code></span>
                <span>{c}</span>
              </div>
            ))}
          </div>
          <p>A stolen watcher key cannot change the release or the exit list. The contract has unit tests for exactly that.</p>
      </>
    ),
    watcher: (
      <>
          <h2 id="watcher">The watcher</h2>
          <p>The watcher hashes every script on the live site and compares it with the registry.</p>
          <div className="table">
            <div className="trow thead three"><span>Alarm</span><span>Triggered by</span><span>Meaning</span></div>
            {ALARMS.map(([a, b, c]) => (
              <div className="trow three" key={a}>
                <span><b>{a}</b></span>
                <span>{b}</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
          <Code>{`npx tsx scripts/watcher.ts --url <official site> --baseline     # print a fingerprint to publish
npx tsx scripts/watcher.ts --registry <registry> --protocol burrow  # check once`}</Code>
      </>
    ),
    bridge: (
      <>
          <h2 id="bridge">Bridge out</h2>
          <p>
            After a recovered exit you can send tokens to USDC on Base, Ethereum, Arbitrum or Solana through NEAR Intents&apos; 1Click
            API. You see a quote first. A separate guard accepts only the one transfer the quote asks for: the quoted amount, to the
            quoted deposit address, with exactly 1 yoctoNEAR attached. Dry quotes need no API key.
          </p>
      </>
    ),
    kit: (
      <>
          <h2 id="kit">Save the kit</h2>
          <p>
            Keep a copy of Evac as plain files, and check it matches the published build before you rely on it.
          </p>
          <Code>{`npm run kit                       # writes kit/evac-kit.tar.gz
tar -xzf evac-kit.tar.gz && cd evac-kit
node verify.mjs                   # MATCH or MISMATCH
npx serve app                     # run it`}</Code>
          <p>See <Link href="/kit">Save the kit</Link>.</p>
      </>
    ),
    extension: (
      <>
          <h2 id="extension">Browser extension</h2>
          <p>
            A Chrome extension that compares the site you are on with what the protocol published in its registry. It warns on
            listed look-alike addresses, on the official site when a script changed, and when the protocol has raised an alarm.
            It warns only; the Exit Guard still decides what can be signed.
          </p>
          <Code>{`npm run extension                 # builds extension/dist
# chrome://extensions -> Developer mode -> Load unpacked -> extension/dist`}</Code>
          <p>See <Link href="/extension">Browser extension</Link>.</p>
      </>
    ),
    trouble: (
      <>
          <h2 id="trouble">Troubleshooting</h2>
          <div className="faq">
            <details><summary>It says Not confirmed as recovered, but the transaction succeeded</summary><p>On NEAR a transaction can succeed while a later step fails. If a token transfer fails, Burrow refunds the deposit. The usual cause is that your account isn&apos;t registered with that token contract. Register it (a one-time storage deposit of about 0.00125 NEAR) and try again.</p></details>
            <details><summary>I only got a partial exit</summary><p>You have an open loan that your other deposits can&apos;t repay. Evac withdraws only the non-collateral deposits and shows how much is missing. Add that amount, or repay the loan, and scan again.</p></details>
            <details><summary>Scan stops with an RPC error</summary><p>If two providers disagree, Evac refuses to act on a wrong answer. Wait a few seconds and scan again. The Network health card on the dashboard shows which providers are slow or down.</p></details>
            <details><summary>My wallet sends me away and back</summary><p>Some wallets use a redirect. Evac saves your starting balances first, then finishes the check when you return.</p></details>
            <details><summary>The Guard refused my own withdrawal</summary><p>Check that your connected wallet is the account you scanned, and that the exit list matches the protocol&apos;s current contract.</p></details>
          </div>
      </>
    ),
    limits: (
      <>
          <h2 id="limits">Limits</h2>
          <ul>
            <li>Evac has not yet signed a real withdrawal. It has been checked read-only against 11 real accounts and 18 real historical Burrow transactions (the Guard accepted all 18 and every receipt succeeded), but wallet signing itself is untested.</li>
            <li>Accounts with a loan use <code>execute_with_pyth</code>, the price-checked call Burrow&apos;s own front end makes. If your other deposits can repay the loan, Evac repays and exits fully; otherwise you get a partial exit and are told what is missing. Not yet tried with real money.</li>
            <li>The live Burrow contract differs from its archived source. With an open loan, Burrow may ask for a price check even on a withdraw. If so, the transaction fails safely and Evac says so.</li>
            <li>The registry contract and DAO are written and tested but not deployed yet, so the exit list is built in.</li>
            <li>Only Burrow is supported. Other protocols are planned.</li>
            <li>Evac is early, open-source hackathon software. Try it with a small position first.</li>
          </ul>
      </>
    ),
    glossary: (
      <>
          <h2 id="glossary">Glossary</h2>
          <div className="table">
            {GLOSSARY.map(([a, b]) => (
              <div className="trow" key={a}>
                <span><b>{a}</b></span>
                <span>{b}</span>
              </div>
            ))}
          </div>
      </>
    ),
  };
  return (
    <div className="site">
      <SiteNav />
      <DocsShell groups={TOC} sections={sections} />
      <SiteFooter />
    </div>
  );
}

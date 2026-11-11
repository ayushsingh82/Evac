import Link from "next/link";
import { CandyIcon } from "./candy";
import { SiteFooter } from "./chrome";
import { hasLogo, ProtocolIcon } from "./components";
import Hero from "./Hero";

const BUILT_ON = [
  { id: "near", name: "NEAR" },
  { id: "burrow", name: "Burrow" },
  { id: "intents", name: "NEAR Intents" },
  { id: "sputnik", name: "Sputnik DAO" },
  { id: "pyth", name: "Pyth" },
  { id: "mynear", name: "MyNearWallet" },
  { id: "meteor", name: "Meteor" },
  { id: "hot", name: "HOT" },
];

const PROTOCOLS = [
  { id: "burrow", name: "Burrow lending", note: "contract.main.burrow.near", status: "Supported" },
  { id: "intents", name: "NEAR Intents bridge-out", note: "USDC on Base, Ethereum, Arbitrum, Solana", status: "Supported" },
  { id: "ref", name: "Ref Finance LP", note: "Liquidity positions", status: "Planned" },
  { id: "metapool", name: "Liquid staking", note: "Unstake and withdraw", status: "Planned" },
];

const STEPS = [
  { kind: 2 as const, t: "Scan", d: "Read your position straight from the contracts. Four independent RPC providers must agree at one pinned block." },
  { kind: 0 as const, t: "Plan", d: "Build the withdrawal on your machine: free collateral, then withdraw everything, in one call." },
  { kind: 3 as const, t: "Guard", d: "The Exit Guard refuses anything that isn't a plain withdrawal to you. There is no override." },
  { kind: 1 as const, t: "Verify", d: "Sign with your wallet. Evac says Recovered only when every step succeeded and your balance rose." },
];

const INCIDENTS = [
  { t: "DNS hijack", d: "Curve, 2022. The site was swapped for a copy that asked users to approve a drainer. The contracts were never touched." },
  { t: "Social-engineered registrar", d: "Balancer, 2023. The domain's registrar was tricked and the front end was swapped. The contracts kept working." },
  { t: "Poisoned library", d: "Ledger Connect Kit, 2023. A bad release put a drainer inside many apps at once." },
  { t: "Plain outage", d: "A site can simply go dark: lost domain, blocked region, a company that shut down. The funds stay on chain, out of reach." },
];

const FEATURES = [
  { t: "Fail-closed Exit Guard", d: "Blocks AddKey, transfers, account deletion, unknown contracts and methods, odd deposits, and anything it can't decode." },
  { t: "Provider quorum", d: "A dead provider is tolerated. One that disagrees stops the exit instead of guessing." },
  { t: "Receipt-level proof", d: "NEAR runs in steps. A failed token transfer can hide behind a success, so Evac checks every receipt and your balance." },
  { t: "Hijack check", d: "Paste any transaction from a site you distrust and see in plain words whether it is a safe exit." },
  { t: "On-chain registry", d: "A DAO-owned contract publishes the kit hash, exit list and alarm. Its keys can each call one method." },
  { t: "No server of ours", d: "Evac is a static, reproducible build. There is nothing for anyone to switch off." },
];

const PROOF: [string, string, string][] = [
  ["Read 11 real Burrow accounts (no loan, with loan, supplied only, missing)", "All scanned, planned and accepted by the Guard", "npx tsx scripts/scan.ts zavodil.near"],
  ["Replay 18 real past Burrow withdrawals and repayments through the Guard", "18 of 18 accepted, every receipt clean", "test/hijack-corpus.test.ts + scripts/scan.ts"],
  ["Hijacked-site payloads (add key, send NEAR, look-alike contract, hidden borrow, extra fields)", "21 attack payloads refused, the real exit passes", "npx vitest run test/guard.test.ts test/hijack-corpus.test.ts"],
  ["A provider that lies or goes quiet", "Dead one tolerated, disagreeing ones stop the read", "npx vitest run test/rpc.test.ts"],
  ["A transfer that fails behind a successful first step", "Reported as not recovered, with the reason", "npx vitest run test/verify.test.ts"],
  ["A changed or injected script on a real DeFi site", "Flagged Compromised; six repeat loads of the real site stay Ok", "npx tsx scripts/watcher.ts --url <site> --baseline"],
  ["Build the app twice", "Same hash both times", "npm run build && node scripts/hash-out.mjs"],
  ["Registry contract: a key calls a method it was not given", "Rejected (15 contract tests)", "cd contracts/registry && cargo test"],
];

const COMPARE: [string, string, string, string][] = [
  ["Works when the official site is down", "Only while the explorer is up", "Yes, through a gateway", "Yes, a static app with nothing of ours to switch off"],
  ["Finds your positions for you", "No, you bring the details", "Yes", "Yes, read from the contract"],
  ["Stops you approving a drainer", "No", "No, it is the full app", "Yes, only plain withdrawals to you pass"],
  ["Checks the chain data it shows", "One backend", "One RPC", "Four providers must agree at one block"],
  ["Confirms the money arrived", "No", "No", "Yes, every receipt plus a balance check"],
];

const FAQ = [
  ["Does Evac hold my keys or funds?", "No. Your wallet signs. Evac only reads the chain, builds the transaction, and checks it before your wallet sees it."],
  ["What if I have an open loan?", "If your other deposits can repay it, Evac repays the loan from them and then exits fully, using Burrow's price-checked call. If they can't, you get a partial exit of your non-collateral deposits and Evac tells you what is missing. The repay-and-exit path hasn't been tried with real money yet."],
  ["What does it cost?", "Network gas only. If you bridge out, NEAR Intents' 1Click quote shows its fee before you commit. Evac takes nothing."],
  ["Which wallets work?", "Anything wallet-selector supports; MyNearWallet, Meteor and HOT are wired in."],
  ["What happens if the exit fails?", "Evac checks every receipt and your balance. If a token transfer failed and the protocol refunded the deposit, it tells you instead of saying Recovered."],
  ["Is it ready for real money?", "It's early, open-source hackathon software. Try it with a small position first, and read the limits in the docs."],
];

export default function Landing() {
  return (
    <div className="site">
      <Hero />

      <main className="wrap">
        <section className="band" aria-label="Built on">
          <div className="label">Built on</div>
          <div className="band-row">
            {BUILT_ON.map((b) => (
              <span className="band-item" key={b.id + b.name}>
                {hasLogo(b.id) && <ProtocolIcon id={b.id} size={30} />}
                {b.name}
              </span>
            ))}
          </div>
        </section>

        <section className="sec two">
          <div>
            <div className="label">The problem</div>
            <h2 className="big">The contracts are fine. The website is the weak point.</h2>
            <p className="soft">
              When a website is hijacked or simply goes offline, nothing is wrong with the contracts and your money is still there.
              People sign what looks like the real site and approve a drainer, or find the site gone and can&apos;t reach their funds.
              The usual fallback, a block explorer&apos;s &ldquo;write contract&rdquo; page, is another website. Evac is a way out that
              never goes through the front door: it reads your position from the contracts, refuses anything that isn&apos;t a plain
              withdrawal to you, and tells you honestly whether the money came back.
            </p>
          </div>
          <div className="stack-cards">
            {INCIDENTS.map((i) => (
              <div className="plain-card" key={i.t}>
                <b>{i.t}</b>
                <p>{i.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec" id="how">
          <div className="label">How it works</div>
          <h2 className="big">Four steps from panic to recovered</h2>
          <div className="tiles">
            {STEPS.map((s, i) => (
              <div className={`tile t${s.kind}`} key={s.t}>
                <div className="tile-grain" />
                <CandyIcon kind={s.kind} size={84} />
                <span className="tile-n">0{i + 1}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec" id="protocols">
          <div className="label">Protocols</div>
          <h2 className="big">What Evac can exit today</h2>
          <div className="list">
            {PROTOCOLS.map((p) => (
              <div className="list-row" key={p.id}>
                <ProtocolIcon id={p.id} size={44} />
                <div className="grow">
                  <b>{p.name}</b>
                  <span className="mono">{p.note}</span>
                </div>
                <span className={`pill ${p.status === "Supported" ? "pill-ok" : "pill-soon"}`}>{p.status}</span>
              </div>
            ))}
          </div>
          <p className="fine">Burrow is checked against live accounts; a real mainnet withdrawal is the next thing to prove.</p>
        </section>

        <section className="sec" id="security">
          <div className="label">Security</div>
          <h2 className="big">Built so a hijacked site can&apos;t talk you into it</h2>
          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <div className="feat" key={f.t}>
                <CandyIcon kind={(i % 4) as 0 | 1 | 2 | 3} size={52} />
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
          <div className="term">
            <div className="term-bar"><i /><i /><i /><span>Exit Guard</span></div>
            <pre>{`site asks you to sign:   AddKey  ed25519:attacker  (FullAccess)

Exit Guard: refused
  - Blocked: this transaction adds a new access key to your
    account, which can give someone control of it.`}</pre>
          </div>
        </section>

        <section className="sec" id="compare">
          <div className="label">Why not the usual fallback</div>
          <h2 className="big">Etherscan-style &ldquo;write contract&rdquo; is just another website</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th></th><th>Block explorer &ldquo;write contract&rdquo;</th><th>A copy of the app</th><th>Evac</th></tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r[0]}>
                    <th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td className="us">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sec" id="proof">
          <div className="label">Don&apos;t trust us, check</div>
          <h2 className="big">Every claim has a command you can run</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>What we tried</th><th>Result</th><th>Reproduce</th></tr></thead>
              <tbody>
                {PROOF.map((r) => (
                  <tr key={r[0]}><td>{r[0]}</td><td className="us">{r[1]}</td><td><code>{r[2]}</code></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine">
            Not proven yet: a real withdrawal signed with a real wallet, a real bridge swap, and the registry running on mainnet. We say
            so rather than claim it. Everything above was read-only on live data.
          </p>
        </section>

        <section className="sec two" id="faq">
          <div>
            <div className="label">Questions</div>
            <h2 className="big">Plain answers</h2>
            <p className="soft">More detail in the <Link href="/docs">docs</Link>.</p>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta2">
          <div className="tile-grain" />
          <h2>Know your exit before you need it.</h2>
          <p>Open Evac, scan your account, and see your exit plan now, while the website still works.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link className="btn2" href="/dashboard">Open the exit</Link>
            <Link className="btn2" href="/docs">Read the docs</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

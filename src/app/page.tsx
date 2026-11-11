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
  { t: "Hijacked domain", d: "Curve, 2022" },
  { t: "Tricked registrar", d: "Balancer, 2023" },
  { t: "Poisoned script", d: "Ledger Connect Kit, 2023" },
  { t: "Site just gone", d: "Lost domain, blocked region, closed company" },
];

const FEATURES = [
  { t: "Fail-closed Exit Guard", d: "Blocks AddKey, transfers, account deletion, unknown contracts and methods, odd deposits, and anything it can't decode." },
  { t: "Provider quorum", d: "A dead provider is tolerated. One that disagrees stops the exit instead of guessing." },
  { t: "Receipt-level proof", d: "NEAR runs in steps. A failed token transfer can hide behind a success, so Evac checks every receipt and your balance." },
  { t: "Hijack check", d: "Paste any transaction from a site you distrust and see in plain words whether it is a safe exit." },
  { t: "On-chain registry", d: "A DAO-owned contract publishes the kit hash, exit list and alarm. Its keys can each call one method." },
  { t: "Loans handled", d: "If your other deposits cover the loan, Evac repays it and exits fully. If not, it says what is missing." },
  { t: "Look-alike warnings", d: "The browser extension flags listed look-alike sites and pages that no longer match what the protocol published." },
  { t: "No server of ours", d: "Evac is a static, reproducible build. There is nothing for anyone to switch off." },
];

const PROOF: [string, string, string][] = [
  ["11 real accounts scanned", "All planned and approved by the Guard", "npx tsx scripts/scan.ts zavodil.near"],
  ["18 real past transactions replayed", "18 of 18 pass, receipts clean", "npx vitest run test/hijack-corpus.test.ts"],
  ["Hijack payloads thrown at the Guard", "All refused; the real exit passes", "npx vitest run test/guard.test.ts"],
  ["A provider lies or goes quiet", "Read continues safely or stops", "npx vitest run test/rpc.test.ts"],
  ["A transfer fails behind a success", "Not marked recovered", "npx vitest run test/verify.test.ts"],
  ["A real site gets a swapped script", "Flagged", "npx tsx scripts/watcher.ts --url <site> --baseline"],
  ["Build the app twice", "Same hash", "npm run build && node scripts/hash-out.mjs"],
  ["A registry key steps out of its role", "Rejected", "cd contracts/registry && cargo test"],
];

const COMPARE: [string, string, string, string][] = [
  ["Site is down", "Explorer must be up", "Needs a gateway", "Works offline"],
  ["Finds your funds", "You supply details", "Yes", "Automatic"],
  ["Blocks drainers", "No", "No", "Yes"],
  ["Trusts one source", "One backend", "One RPC", "Four must agree"],
  ["Proves it landed", "No", "No", "Yes"],
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
            <h2 className="big">The site breaks. The money doesn&apos;t.</h2>
            <p className="soft">Hijacked or offline, your funds stay in the contracts. Evac reaches them without the website.</p>
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

        <section className="sec" id="take">
          <div className="label">Take it with you</div>
          <h2 className="big">Ready before you need it.</h2>
          <div className="take-grid">
            <div className="plain-card">
              <b>Save the kit</b>
              <p>The whole app as files, with a one-line check that they match the published build.</p>
              <Link className="take-link" href="/kit">Get the kit →</Link>
            </div>
            <div className="plain-card">
              <b>Browser extension</b>
              <p>Warns on look-alikes and tampered pages while you browse.</p>
              <Link className="take-link" href="/extension">See the extension →</Link>
            </div>
            <div className="plain-card">
              <b>Check a transaction</b>
              <p>Paste anything a site asks you to sign and see what it really does.</p>
              <Link className="take-link" href="/dashboard">Try it →</Link>
            </div>
          </div>
        </section>

        <section className="sec" id="compare">
          <div className="label">Why not the usual fallback</div>
          <h2 className="big">A block explorer is another website.</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th></th><th>Block explorer</th><th>App copy</th><th>Evac</th></tr>
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
          <div className="label">Proof</div>
          <h2 className="big">Check it yourself.</h2>
          <p className="soft">Every claim has a command.</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>We tried</th><th>Result</th><th>Run</th></tr></thead>
              <tbody>
                {PROOF.map((r) => (
                  <tr key={r[0]}><td>{r[0]}</td><td className="us">{r[1]}</td><td><code>{r[2]}</code></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine">Not proven yet: a real wallet withdrawal, a real bridge swap, the registry on mainnet.</p>
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

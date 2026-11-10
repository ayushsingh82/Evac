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
  { kind: 2 as const, t: "Scan", d: "Read your position straight from the contracts. Three RPC providers must agree at one pinned block." },
  { kind: 0 as const, t: "Plan", d: "Build the withdrawal on your machine: free collateral, then withdraw everything, in one call." },
  { kind: 3 as const, t: "Guard", d: "The Exit Guard refuses anything that isn't a plain withdrawal to you. There is no override." },
  { kind: 1 as const, t: "Verify", d: "Sign with your wallet. Evac says Recovered only when every step succeeded and your balance rose." },
];

const INCIDENTS = [
  { t: "DNS hijack", d: "Curve, 2022. The site was swapped for a copy that asked users to approve a drainer. The contracts were never touched." },
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

const FAQ = [
  ["Does Evac hold my keys or funds?", "No. Your wallet signs. Evac only reads the chain, builds the transaction, and checks it before your wallet sees it."],
  ["What if I have an open loan?", "Freeing collateral needs price data that this version doesn't build yet, so Evac makes a partial exit of your non-collateral deposits and explains why. Repay first to exit fully."],
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
              When a front end is hijacked or disappears, the money is still sitting in the protocol&apos;s contracts. There just
              isn&apos;t a safe way to reach it. Evac is that way.
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
          <p>Open Evac, scan your account, and see your exit plan now.</p>
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

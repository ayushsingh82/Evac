import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter, SiteNav } from "../chrome";
import { Code } from "../DocsKit";

export const metadata = { title: "Browser extension · Evac" };

function Mock({ url, level, title, body, children }: { url: string; level?: "bad" | "warn"; title?: string; body?: string; children?: ReactNode }) {
  return (
    <div className="mock">
      <div className="mock-bar">
        <i /><i /><i />
        <span className="mock-url">{url}</span>
      </div>
      {level && (
        <div className={`mock-banner ${level}`}>
          <div>
            <b>{title}</b>
            <span>{body}</span>
          </div>
          <em>Dismiss</em>
        </div>
      )}
      <div className="mock-page">{children ?? <><h4>Burrow</h4><p>Lend and borrow on NEAR</p><u>Connect wallet</u></>}</div>
    </div>
  );
}

const WHEN: { t: string; d: string }[] = [
  { t: "Look-alike address", d: "The protocol listed it. You get a red banner and the real address." },
  { t: "Changed official site", d: "A script was swapped or a new one appeared. Red banner." },
  { t: "Protocol alarm", d: "Red for Compromised, amber for Degraded, with the protocol's note." },
  { t: "Everything matches", d: "Silence. It never nags." },
];

const STEPS: { t: string; d: string }[] = [
  { t: "Read", d: "Gets the protocol's entry from the registry. Several NEAR providers must agree." },
  { t: "Compare", d: "Checks the address against the look-alike list and the page's scripts against the published fingerprint." },
  { t: "Warn", d: "Shows a banner on the page. It never blocks and never sends your browsing anywhere." },
];

export default function ExtensionPage() {
  return (
    <div className="site">
      <SiteNav />
      <main className="wrap" style={{ maxWidth: 980, paddingTop: 48 }}>
        <div className="label">Browser extension</div>
        <h1 className="big" style={{ marginTop: 8 }}>A warning on the page, before you sign.</h1>
        <p className="soft">Compares the DeFi site you are on with what the protocol published.</p>

        <div className="mock-grid">
          <Mock url="burrow-rewards.example" level="bad" title="Look-alike site. Do not connect a wallet." body="Burrow lists this address as a look-alike." />
          <Mock url="app.burrow.example" level="bad" title="This page does not match what Burrow published." body="New script from an unknown origin." />
          <Mock url="app.burrow.example" level="warn" title="Burrow has raised an alarm (Degraded)." body="Site redeployed. Check official channels." />
        </div>

        <section className="sec" style={{ marginTop: 56 }}>
          <div className="label">When it speaks</div>
          <div className="take-grid">
            {WHEN.map((w) => (
              <div className="plain-card" key={w.t}>
                <b>{w.t}</b>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec" style={{ marginTop: 56 }}>
          <div className="label">How it decides</div>
          <div className="tiles" style={{ marginTop: 16 }}>
            {STEPS.map((s, i) => (
              <div className={`tile t${i % 4}`} key={s.t} style={{ minHeight: 190 }}>
                <div className="tile-grain" />
                <span className="tile-n">0{i + 1}</span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec" id="try" style={{ marginTop: 56 }}>
          <div className="label">Try it in two minutes</div>
          <h2 className="big" style={{ fontSize: 30 }}>No registry needed for the demo.</h2>

          <h3 className="ex-h">1. Build and load it</h3>
          <Code>{`npm run extension`}</Code>
          <p className="soft">Open <code>chrome://extensions</code>, turn on Developer mode, choose Load unpacked, pick <code>extension/dist</code>.</p>

          <h3 className="ex-h">2. Start the demo pages</h3>
          <Code>{`npm run demo:sites`}</Code>
          <p className="soft">It serves three local pages and prints demo data. Paste that into the extension&apos;s Settings, under Demo data, and Save.</p>

          <h3 className="ex-h">3. Visit them</h3>
          <div className="ex-urls">
            <div><code>http://app.localhost:4600/</code><span>clean, stays quiet</span></div>
            <div><code>http://app.localhost:4600/tampered</code><span>drainer script added, red banner</span></div>
            <div><code>http://burrow-rewards.localhost:4600/</code><span>listed look-alike, red banner</span></div>
          </div>
          <p className="fine">Tested in a real Chrome. Demo data only stands in for the registry; the page checks are the same.</p>
        </section>

        <section className="sec" style={{ marginTop: 56 }}>
          <div className="label">Limits</div>
          <ul className="soft" style={{ paddingLeft: 20, lineHeight: 1.7, marginTop: 8, listStyle: "disc" }}>
            <li>It warns; the Exit Guard is what refuses bad transactions.</li>
            <li>For real use it needs the registry, which is not deployed yet.</li>
            <li>Chrome only for now.</li>
          </ul>
          <p className="soft">Also: <Link href="/kit">save the kit</Link> · <Link href="/docs#extension">docs</Link></p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

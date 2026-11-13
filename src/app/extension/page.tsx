import Link from "next/link";
import { SiteFooter, SiteNav } from "../chrome";
import { Code } from "../DocsKit";
import { ExtensionDemo } from "../ExtensionDemo";

export const metadata = { title: "Browser extension · Evac" };

const WHEN: { t: string; d: string; tone: "bad" | "warn" | "ok" }[] = [
  { t: "Look-alike address", d: "The protocol listed it. You get a red banner and the real address.", tone: "bad" },
  { t: "Changed official site", d: "A script was swapped or a new one appeared. Red banner.", tone: "bad" },
  { t: "Protocol alarm", d: "Red for Compromised, amber for Degraded, with the protocol's note.", tone: "warn" },
  { t: "Everything matches", d: "Silence. It never nags.", tone: "ok" },
];

const STEPS: { t: string; d: string }[] = [
  { t: "Read", d: "Gets the protocol's entry from the registry. Several NEAR providers must agree." },
  { t: "Compare", d: "Checks the address against the look-alike list and the page's scripts against the published fingerprint." },
  { t: "Warn", d: "Shows a banner on the page. It never blocks and never sends your browsing anywhere." },
];

const PROMISES: [string, string][] = [
  ["Warns, never blocks", "You stay in control. The Exit Guard is what refuses a bad transaction."],
  ["No browsing sent out", "The check happens in your browser against public NEAR data."],
  ["Silent when fine", "No banner, no badge, no noise on a site that matches."],
  ["Open source", "Built from this repo with one command. Read it before you load it."],
];

const FAQ: [string, string][] = [
  ["Does it see my wallet or my keys?", "No. It reads the page address and the page's scripts. It never touches your wallet, seed phrase or signing."],
  ["Does it replace the Exit Guard?", "No. The extension only warns. The Exit Guard decides what can be signed, and has no override."],
  ["Where does it get its data?", "From the protocol's entry in the Evac registry contract on NEAR. Several providers must agree before it trusts an answer."],
  ["Which browsers work?", "Chrome for now, and other Chromium browsers that can load an unpacked extension."],
];

export default function ExtensionPage() {
  return (
    <div className="site">
      <SiteNav />
      <main className="wrap xw">
        <section className="xhero">
          <div>
            <div className="label">Browser extension</div>
            <h1 className="big" style={{ marginTop: 8 }}>A warning on the page, before you sign.</h1>
            <p className="soft">
              Evac for Chrome compares the DeFi site you are on with what the protocol published, and speaks up only when
              something is wrong.
            </p>
            <div className="xhero-cta">
              <a href="#try" className="btn2">Try it in two minutes</a>
              <Link href="/docs#extension" className="xlink">Read the docs →</Link>
            </div>
            <div className="xchips">
              <span>Look-alike sites</span>
              <span>Swapped scripts</span>
              <span>Protocol alarms</span>
            </div>
          </div>
          <ExtensionDemo />
        </section>

        <section className="sec">
          <div className="label">When it speaks</div>
          <div className="take-grid">
            {WHEN.map((w) => (
              <div className={`plain-card xwhen ${w.tone}`} key={w.t}>
                <i className="xdot" />
                <b>{w.t}</b>
                <p>{w.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec">
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

        <section className="sec" id="try">
          <div className="label">Try it in two minutes</div>
          <h2 className="big" style={{ fontSize: 30 }}>Install it and check the official site.</h2>
          <ol className="xsteps">
            <li>
              <span className="xn">1</span>
              <div>
                <h3>Build and load it</h3>
                <Code>{`npm run extension`}</Code>
                <p className="soft">Open <code>chrome://extensions</code>, turn on Developer mode, choose Load unpacked, pick <code>extension/dist</code>.</p>
              </div>
            </li>
            <li>
              <span className="xn">2</span>
              <div>
                <h3>Open the official site</h3>
                <div className="ex-urls">
                  <div><code>https://getevac.vercel.app</code><span><i className="dot ok" /> matches what was published, stays quiet</span></div>
                </div>
                <p className="soft">The extension&apos;s default points at it. Nothing to configure.</p>
              </div>
            </li>
            <li>
              <span className="xn">3</span>
              <div>
                <h3>Know what a warning looks like</h3>
                <p className="soft">On a look-alike address, or a page whose scripts changed, you get a red banner at the top of the page. Use the cases at the top of this page to see each one.</p>
              </div>
            </li>
          </ol>
          <p className="fine">Tested in a real Chrome (8 of 8 scenarios: clean, tampered, look-alike and both alarms).</p>
        </section>

        <section className="sec">
          <div className="label">What you can count on</div>
          <div className="take-grid">
            {PROMISES.map(([t, d]) => (
              <div className="plain-card" key={t}>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sec">
          <div className="label">Questions</div>
          <div className="faq" style={{ marginTop: 12 }}>
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="sec">
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

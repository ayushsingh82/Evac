import Link from "next/link";
import { SiteFooter, SiteNav } from "../chrome";
import { Code } from "../DocsKit";

export const metadata = { title: "Browser extension · Evac" };

const ROWS: [string, string][] = [
  ["A site on the protocol's look-alike list", "A red banner: do not connect a wallet, here is the real address."],
  ["The official site, with a script that changed or a new one from another origin", "A red banner before you sign anything, and a pointer to Evac."],
  ["The protocol has raised an alarm in its registry", "A banner (red for Compromised, amber for Degraded) with the note it published."],
  ["The official site, matching what the protocol published", "Nothing. It stays quiet."],
  ["Any other site", "Nothing. It does not look at them."],
];

export default function ExtensionPage() {
  return (
    <div className="site">
      <SiteNav />
      <main className="wrap" style={{ maxWidth: 860, paddingTop: 48 }}>
        <div className="label">Browser extension</div>
        <h1 className="big" style={{ marginTop: 8 }}>A second pair of eyes while you browse</h1>
        <p className="soft">
          The extension compares the DeFi site you are on with what the protocol published in its on-chain registry, and warns you
          when they differ. It uses the same fingerprint check as the watcher, so the two never disagree.
        </p>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>You are on</th><th>The extension</th></tr></thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r[0]}><th scope="row">{r[0]}</th><td>{r[1]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="sec" style={{ marginTop: 40 }}>
          <h2 className="big" style={{ fontSize: 28 }}>Install it (developer mode)</h2>
          <Code>{`npm run extension          # builds extension/dist`}</Code>
          <ol className="soft" style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Open <code>chrome://extensions</code> and turn on Developer mode.</li>
            <li>Choose Load unpacked and pick the <code>extension/dist</code> folder.</li>
            <li>Open its Settings and enter the registry account, the protocols to watch, and where Evac runs.</li>
          </ol>
        </section>

        <section className="sec" style={{ marginTop: 40 }}>
          <h2 className="big" style={{ fontSize: 28 }}>Honest limits</h2>
          <ul className="soft" style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            <li>It is only as good as the registry. With no registry set up, it has nothing to compare with and says nothing.</li>
            <li>The registry contract is written and tested but not deployed yet, so the live alarm and fingerprint are not on mainnet.</li>
            <li>It warns; it does not block a page or stop a wallet pop-up. Evac&apos;s Exit Guard is what refuses bad transactions.</li>
            <li>It sends nothing about your browsing anywhere. To check a page it fetches that page&apos;s own public scripts, from your browser.</li>
            <li>Chrome only for now. Tested in a real Chrome with a local page set: clean, tampered, look-alike and both alarm levels.</li>
          </ul>
          <p className="soft">See also <Link href="/kit">save the kit</Link>.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

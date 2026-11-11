import Link from "next/link";
import { SiteFooter, SiteNav } from "../chrome";
import { Code } from "../DocsKit";

export const metadata = { title: "Save the kit · Evac" };

export default function KitPage() {
  return (
    <div className="site">
      <SiteNav />
      <main className="wrap" style={{ maxWidth: 860, paddingTop: 48 }}>
        <div className="label">The exit kit</div>
        <h1 className="big" style={{ marginTop: 8 }}>Save your way out before you need it</h1>
        <p className="soft">
          If a protocol&apos;s website is hijacked or gone, you won&apos;t be able to download a trustworthy copy of anything. So take a
          copy now. The kit is Evac as plain files. It talks only to NEAR and to your wallet, and you can check that it is exactly
          the published build.
        </p>

        <section className="sec" style={{ marginTop: 48 }}>
          <h2 className="big" style={{ fontSize: 28 }}>1. Download it</h2>
          <p className="soft">One file. Save it somewhere you will find it, like a USB stick or your cloud drive.</p>
          <a className="kit-dl" href="/download/evac-kit.tar.gz" download>
            <span>Download the kit</span>
            <small>evac-kit.tar.gz</small>
          </a>
          <p className="fine">Prefer to build it yourself? Run <code>npm run kit</code> in the Evac source folder. You get the same file.</p>
        </section>

        <section className="sec" style={{ marginTop: 40 }}>
          <h2 className="big" style={{ fontSize: 28 }}>2. Check it</h2>
          <p className="soft">
            The build is reproducible: the same source always gives the same fingerprint. Unpack the kit and run the stand-alone check
            (it needs only Node and no install).
          </p>
          <Code>{`tar -xzf evac-kit.tar.gz && cd evac-kit
node verify.mjs                       # compares with the SHA256 file in the kit
node verify.mjs sha256:<hash>         # compares with a hash you got from the protocol's registry or the README`}</Code>
          <p className="soft">
            <b>MATCH</b> means these files are exactly the published build. <b>MISMATCH</b> means do not use them. One changed byte, one
            added file or one missing file gives a mismatch. The best fingerprint to compare with is the one the protocol publishes in
            its registry, which a hijacked website cannot change.
          </p>
        </section>

        <section className="sec" style={{ marginTop: 40 }}>
          <h2 className="big" style={{ fontSize: 28 }}>3. Run it when you need it</h2>
          <Code>{`npx serve app
# then open http://localhost:3000/dashboard`}</Code>
          <p className="soft">
            Scan your account, read the plan, and sign with your own wallet. The Exit Guard still refuses anything that is not a plain
            withdrawal to you.
          </p>
        </section>

        <section className="sec" style={{ marginTop: 40 }}>
          <h2 className="big" style={{ fontSize: 28 }}>What the kit is not</h2>
          <ul className="soft" style={{ paddingLeft: 20, lineHeight: 1.7, listStyle: "disc" }}>
            <li>It is not a wallet. It never holds keys. Your wallet signs.</li>
            <li>The wallet pop-ups (MyNearWallet, Meteor, HOT) are their own sites. If your wallet&apos;s website is also down, use another wallet.</li>
            <li>It needs at least two working NEAR RPC providers that agree.</li>
          </ul>
          <p className="soft">
            Also see the <Link href="/extension">browser extension</Link> and the <Link href="/docs">docs</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

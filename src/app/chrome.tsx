import Link from "next/link";
import { EvacMark } from "./logo";

/** Slim cream nav for inner pages (the landing page has the hero's own nav). */
export function SiteNav() {
  return (
    <nav className="sn">
      <Link href="/" className="hx-logo" style={{ fontSize: 24 }}>
        <EvacMark />
        evac
      </Link>
      <div className="sn-links">
        <Link href="/#how">How it works</Link>
        <Link href="/#protocols">Protocols</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/dashboard" className="hx-join sn-btn">Open Evac</Link>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="sf">
      <div className="sf-in">
        <div className="sf-brand">
          <Link href="/" className="hx-logo" style={{ fontSize: 24 }}>
            <EvacMark />
            evac
          </Link>
          <p>A fire exit for NEAR DeFi. When the website is hijacked or gone, your money is still in the contracts. Evac is the way out that never goes through the front door.</p>
        </div>
        <div>
          <h4>Product</h4>
          <Link href="/dashboard">Open Evac</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#protocols">Protocols</Link>
        </div>
        <div>
          <h4>Learn</h4>
          <Link href="/docs">Docs</Link>
          <Link href="/docs#guard">Exit Guard</Link>
          <Link href="/docs#verify">Verify the kit</Link>
        </div>
        <div>
          <h4>Build</h4>
          <a href="https://github.com/ayushsingh82/Evac">GitHub</a>
          <a href="https://docs.near-intents.org">NEAR Intents</a>
          <a href="https://docs.near.org">NEAR docs</a>
        </div>
      </div>
      <p className="sf-note">Evac is early, open-source hackathon software. Try it with a small position first. Partner names and logos belong to their respective owners and are used only to identify the protocols Evac works with.</p>
      <div className="sf-giant" aria-hidden>evac</div>
    </footer>
  );
}

"use client";

import { useState } from "react";

const CASES = [
  { id: "ok", tab: "Clean site", url: "app.burrow.example", level: null, title: "", body: "", note: "Everything matches what the protocol published. The extension stays silent." },
  { id: "tamper", tab: "Swapped script", url: "app.burrow.example", level: "bad", title: "This page does not match what Burrow published.", body: "A new script from an unknown origin was added.", note: "Same address, different content. This is what a hijack looks like." },
  { id: "twin", tab: "Look-alike", url: "burrow-rewards.example", level: "bad", title: "Look-alike site. Do not connect a wallet.", body: "Burrow lists this address as a look-alike.", note: "Not the official site. You also see the real address to go to." },
  { id: "alarm", tab: "Protocol alarm", url: "app.burrow.example", level: "warn", title: "Burrow has raised an alarm (Degraded).", body: "Site redeployed. Check official channels.", note: "The protocol itself flagged a problem. Red for Compromised, amber for Degraded." },
] as const;

/** An interactive browser mock-up: pick a situation and see what the extension shows. */
export function ExtensionDemo() {
  const [id, setId] = useState<(typeof CASES)[number]["id"]>("tamper");
  const c = CASES.find((x) => x.id === id)!;
  return (
    <div className="xd">
      <div className="xd-tabs" role="tablist" aria-label="Situation">
        {CASES.map((x) => (
          <button key={x.id} role="tab" aria-selected={id === x.id} className={id === x.id ? "on" : ""} onClick={() => setId(x.id)}>
            <i className={`dot ${x.level ?? "ok"}`} />
            {x.tab}
          </button>
        ))}
      </div>
      <div className="mock xd-mock">
        <div className="mock-bar">
          <i /><i /><i />
          <span className="mock-url">https://{c.url}</span>
        </div>
        {c.level && (
          <div className={`mock-banner ${c.level}`} key={c.id}>
            <div>
              <b>{c.title}</b>
              <span>{c.body}</span>
            </div>
            <em>Dismiss</em>
          </div>
        )}
        <div className="mock-page xd-page">
          <h4>Burrow</h4>
          <p>Lend and borrow on NEAR</p>
          <u>Connect wallet</u>
        </div>
      </div>
      <p className="xd-note">{c.note}</p>
    </div>
  );
}

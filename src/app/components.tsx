// Shared presentational pieces for the landing page and the dashboard.
import type { ReactNode } from "react";
import type { GuardVerdict } from "@/lib/types";
import type { ExitReport } from "@/lib/verify";
import { IconAlert, IconCheck, IconLayers, IconShield } from "./icons";

/** Official logos, saved locally in /public/logos. Brands without a confirmed official logo get no mark. */
const LOGOS: Record<string, { src: string; name: string; pad?: number; bg?: string }> = {
  near: { src: "/logos/near.svg", name: "NEAR", pad: 0.2 },
  burrow: { src: "/logos/burrow.svg", name: "Burrow", pad: 0 },
  ref: { src: "/logos/ref.svg", name: "Ref Finance", pad: 0 },
  intents: { src: "/logos/near-intents.png", name: "NEAR Intents", pad: 0 },
  pyth: { src: "/logos/pyth.jpg", name: "Pyth", pad: 0 },
  mynear: { src: "/logos/mynearwallet.png", name: "MyNearWallet", pad: 0 },
  meteor: { src: "/logos/meteor.png", name: "Meteor", pad: 0 },
  hot: { src: "/logos/hot.svg", name: "HOT", pad: 0.06 },
};

export const hasLogo = (id: string) => id in LOGOS;

/** A brand's official logo in a rounded tile. Unknown brands get a neutral tile, never a made-up mark. */
export function ProtocolIcon({ id, size = 40 }: { id: string; size?: number }) {
  const l = LOGOS[id];
  const pad = Math.round(size * (l?.pad ?? 0));
  return (
    <span className="pmark" style={{ width: size, height: size, padding: pad }} aria-hidden={!l}>
      {l ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={l.src} alt={`${l.name} logo`} width={size - pad * 2} height={size - pad * 2} />
      ) : (
        <IconLayers />
      )}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`stat-v ${tone ?? ""}`}>{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

export function Stepper({ phase }: { phase: 1 | 2 | 3 | 4 }) {
  const steps = ["Scan", "Review", "Sign", "Recovered"];
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const cls = n < phase ? "done" : n === phase ? "now" : "";
        return (
          <li key={s} className={cls}>
            <span className="n">{n < phase ? "✓" : n}</span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

export function Group({ title, rows }: { title: string; rows: { token_id: string; balance: string }[] }) {
  return (
    <div className="group">
      <div className="label">
        {title} <span className="count">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted small" style={{ margin: "4px 0 0" }}>none</p>
      ) : (
        <table className="pos">
          <tbody>
            {rows.map((r) => (
              <tr key={r.token_id}>
                <td className="mono">{r.token_id}</td>
                <td className="mono amt">{r.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function Verdict({ v }: { v: GuardVerdict }) {
  return (
    <div className={`notice ${v.ok ? "ok-notice" : "bad-notice"}`} role="status">
      <span className={v.ok ? "ok" : "bad"}>{v.ok ? <IconShield /> : <IconAlert />}</span>
      <div>
        <b className={v.ok ? "ok" : "bad"}>{v.ok ? "Exit Guard: safe withdrawal" : "Exit Guard: refused"}</b>
        <ul>
          {(v.ok ? v.explain : v.reasons).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Report({ r }: { r: ExitReport }) {
  return (
    <div className={`notice ${r.recovered ? "ok-notice" : "warn-notice"}`} role="status">
      <span className={r.recovered ? "ok" : "warn"}>{r.recovered ? <IconCheck /> : <IconAlert />}</span>
      <div style={{ minWidth: 0 }}>
        <b className={r.recovered ? "ok" : "warn"} style={{ fontSize: 16 }}>
          {r.recovered ? "Recovered. The money is back in your wallet." : "Not confirmed as recovered."}
        </b>
        {r.deltas.map((d) => (
          <div className="delta" key={d.token}>
            <span className={d.gained ? "ok" : "bad"}>{d.gained ? "✓" : "✗"}</span>
            <span>
              {d.token}: {d.before} → {d.after}
            </span>
          </div>
        ))}
        {r.failures.length > 0 && (
          <ul>
            {r.failures.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

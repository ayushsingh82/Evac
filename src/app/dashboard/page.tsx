"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { planExit, scanBurrow, withdrawnTokens } from "@/lib/burrow";
import { checkTx } from "@/lib/guard";
import { BURROW_MANIFEST } from "@/lib/manifest";
import { loadTrustedManifest, type TrustedManifest } from "@/lib/registry";
import { DEFAULT_RPCS, rpcCall } from "@/lib/rpc";
import { checkStorage, storageWarnings } from "@/lib/storage";
import type { ExitPlan, ExitStep, GuardVerdict, NearTx, Position } from "@/lib/types";
import {
  evaluateExit,
  fetchTxOutcome,
  outcomeFailures,
  snapshotBalances,
  waitForGain,
  type Balances,
  type ExitReport,
  type OutcomeLike,
} from "@/lib/verify";
import { connectedAccount, disconnect, GuardRefusedError, openConnect, signGuarded } from "@/lib/wallet";
import Bridge from "../Bridge";
import { CandyIcon } from "../candy";
import { Group, ProtocolIcon, Report, Stat, Stepper, Verdict } from "../components";
import { IconAlert, IconExit, IconInfo, IconLayers, IconSearch, IconShield, IconWallet } from "../icons";

type Scan = { position: Position | null; plan: ExitPlan | null; block: number; providers: number; failed: number; storage: string[] };
type Pending = { account: string; before: Balances; expected: string[] };
type Tab = "overview" | "exit" | "check" | "registry";

const PENDING_KEY = "evac.pending-exit";

const SAMPLE_BAD = JSON.stringify(
  {
    signerId: "you.near",
    receiverId: "you.near",
    actions: [{ type: "AddKey", publicKey: "ed25519:attacker", accessKey: { permission: "FullAccess" } }],
  },
  null,
  2,
);

const PROTOCOLS = [
  { id: "burrow", name: "Burrow lending", note: "contract.main.burrow.near", status: "Supported" },
  { id: "ref", name: "Ref Finance LP", note: "Liquidity positions", status: "Planned" },
  { id: "metapool", name: "Liquid staking", note: "Unstake and withdraw", status: "Planned" },
  { id: "intents", name: "NEAR Intents", note: "Bridge out via 1Click", status: "Supported" },
];

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <IconLayers /> },
  { id: "exit", label: "Exit", icon: <IconExit /> },
  { id: "check", label: "Check a transaction", icon: <IconShield /> },
  { id: "registry", label: "Registry and watcher", icon: <IconInfo /> },
];

const BANNER: Record<Tab, { kind: 0 | 1 | 2 | 3; label: string; title: string; sub: string }> = {
  overview: { kind: 1, label: "Overview", title: "Your exit at a glance", sub: "Everything Evac checks before you ever need the exit." },
  exit: { kind: 0, label: "Exit", title: "Get your money out", sub: "Scan, review the plan, sign. Evac proves the money came back." },
  check: { kind: 3, label: "Hijack check", title: "Is this transaction safe?", sub: "Paste what a site wants you to sign and see it in plain words." },
  registry: { kind: 2, label: "Registry and watcher", title: "What the protocol published", sub: "Exit list, release hash, site fingerprint and the alarm." },
};

type Health = { url: string; ms: number | null; height: number | null };

const short = (a: string) => (a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [wallet, setWallet] = useState<string | null>(null);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [report, setReport] = useState<ExitReport | null>(null);
  const [txText, setTxText] = useState(SAMPLE_BAD);
  const [txVerdict, setTxVerdict] = useState<GuardVerdict | null>(null);
  const [trust, setTrust] = useState<TrustedManifest | null>(null);
  const manifest = trust?.manifest ?? BURROW_MANIFEST;
  const [health, setHealth] = useState<Health[] | null>(null);

  const finish = useCallback(async (p: Pending, outcome: OutcomeLike) => {
    setStatus("Waiting for your balance to settle…");
    const after = await waitForGain(p.account, p.before, p.expected);
    setReport(evaluateExit(outcomeFailures(outcome), p.before, after, p.expected));
    setStatus(null);
  }, []);

  // On load: restore the wallet, and finish an exit if a redirect wallet just sent the user back.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const acct = await connectedAccount();
        if (!alive) return;
        if (acct) {
          setWallet(acct);
          setAccount((a) => a || acct);
        }
        const hash = new URLSearchParams(window.location.search).get("transactionHashes");
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (hash && raw) {
          const p = JSON.parse(raw) as Pending;
          sessionStorage.removeItem(PENDING_KEY);
          window.history.replaceState({}, "", window.location.pathname);
          setTab("exit");
          setStatus("Checking the transaction…");
          const outcome = await fetchTxOutcome(hash.split(",")[0], p.account);
          if (alive) await finish(p, outcome);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [finish]);

  useEffect(() => {
    loadTrustedManifest(process.env.NEXT_PUBLIC_REGISTRY_ID, "burrow").then(setTrust, () => setTrust(null));
  }, []);

  // Keys 1-4 switch sections (ignored while typing).
  useEffect(() => {
    const order: Tab[] = ["overview", "exit", "check", "registry"];
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < order.length) setTab(order[i]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live provider health: how fast each RPC answers and which block it sees.
  useEffect(() => {
    let alive = true;
    Promise.all(
      DEFAULT_RPCS.map(async (url): Promise<Health> => {
        const t0 = performance.now();
        try {
          const r = await rpcCall<{ sync_info: { latest_block_height: number } }>(url, "status", [], { timeoutMs: 8000 });
          return { url, ms: Math.round(performance.now() - t0), height: r.sync_info.latest_block_height };
        } catch {
          return { url, ms: null, height: null };
        }
      }),
    ).then((h) => {
      if (alive) setHealth(h);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    setScan(null);
    setReport(null);
    try {
      const acct = account.trim();
      if (!acct) throw new Error("Enter a NEAR account.");
      const { position, quorum } = await scanBurrow(acct);
      const plan = position ? planExit(position) : null;
      const storage = plan ? storageWarnings(await checkStorage(acct, withdrawnTokens(plan))) : [];
      setScan({ position, plan, storage, block: quorum.block.height, providers: quorum.agreed.length, failed: quorum.failed.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exitNow(step: ExitStep, plan: ExitPlan) {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const expected = withdrawnTokens(plan);
      setStatus("Recording your balances before the exit…");
      const before = await snapshotBalances(wallet, expected);
      const pending: Pending = { account: wallet, before, expected };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      setStatus("Waiting for your wallet to sign…");
      const outcome = await signGuarded(step.tx, wallet, manifest);
      if (outcome) {
        sessionStorage.removeItem(PENDING_KEY);
        await finish(pending, outcome as OutcomeLike);
      }
      // Redirect wallets leave the page here; the effect above finishes the job on return.
    } catch (e) {
      sessionStorage.removeItem(PENDING_KEY);
      setStatus(null);
      if (e instanceof GuardRefusedError) setError("Refused by the Exit Guard: " + e.verdict.reasons.join(" "));
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function checkPasted() {
    try {
      const tx = JSON.parse(txText) as NearTx;
      setTxVerdict(checkTx(tx, manifest, tx.signerId));
    } catch {
      setTxVerdict({ ok: false, reasons: ["That is not a readable transaction, so it is refused."], explain: [] });
    }
  }

  const mine = wallet !== null && scan?.position?.accountId === wallet;
  const phase: 1 | 2 | 3 | 4 = report ? 4 : scan && status ? 3 : scan ? 2 : 1;
  const alarm = trust?.status && trust.status !== "Ok";
  const pos = scan?.position;

  return (
    <div className="dash">
      <aside className="side">
        <Link href="/" className="side-brand">evac</Link>

        <div className="side-acct">
          {wallet ? (
            <>
              <span className="avatar">{wallet[0]?.toUpperCase()}</span>
              <div className="side-acct-t">
                <b title={wallet}>{short(wallet)}</b>
                <span>Wallet connected</span>
              </div>
              <button className="side-x" aria-label="Disconnect wallet" title="Disconnect" onClick={() => disconnect().then(() => setWallet(null))}>
                ✕
              </button>
            </>
          ) : (
            <button className="dbtn solid wide" onClick={() => openConnect()}>
              <IconWallet /> Connect wallet
            </button>
          )}
        </div>

        <div className="side-sec">Workspace</div>
        <nav className="side-nav" aria-label="Dashboard sections">
          {NAV.map((n, i) => {
            const badge =
              n.id === "exit" && scan?.plan ? (
                <i className={`sbadge ${scan.plan.kind === "full" ? "ok" : "warn"}`}>{scan.plan.kind}</i>
              ) : n.id === "registry" && trust?.status ? (
                <i className={`sbadge ${trust.status === "Ok" ? "ok" : "bad"}`}>{trust.status}</i>
              ) : null;
            return (
              <button key={n.id} aria-pressed={tab === n.id} onClick={() => setTab(n.id)}>
                {n.icon}
                <span className="sn-label">{n.label}</span>
                {badge}
                <kbd>{i + 1}</kbd>
              </button>
            );
          })}
        </nav>

        <div className="side-sec">Protocols</div>
        <div className="side-proto">
          <div className="side-prow">
            <ProtocolIcon id="burrow" size={26} />
            <span>Burrow</span>
            <i className="sbadge ok">live</i>
          </div>
          <div className="side-prow dim">
            <ProtocolIcon id="ref" size={26} />
            <span>Ref Finance</span>
            <i className="sbadge soon">soon</i>
          </div>
          <div className="side-prow dim">
            <ProtocolIcon id="intents" size={26} />
            <span>NEAR Intents</span>
            <i className="sbadge ok">bridge</i>
          </div>
        </div>

        <div className="side-foot">
          <div className="side-net">
            <span className={`hdot ${!health ? "wait" : health.some((h) => h.ms !== null) ? "up" : "down"}`} />
            <div>
              <b>NEAR mainnet</b>
              <span>{health ? `${health.filter((h) => h.ms !== null).length}/${health.length} providers up` : "checking providers…"}</span>
            </div>
          </div>
          <div className="side-links">
            <Link href="/docs">Docs</Link>
          </div>
        </div>
      </aside>

      <div className="dash-main">
        <div className={`dbanner t${BANNER[tab].kind}`}>
          <div className="tile-grain" />
          <div className="dbanner-top row">
            {wallet ? (
              <>
                <span className="dchip mono" title={wallet}>{short(wallet)}</span>
                <button className="dbtn" onClick={() => disconnect().then(() => setWallet(null))}>
                  Disconnect
                </button>
              </>
            ) : (
              <button className="dbtn solid" onClick={() => openConnect()}>
                <IconWallet /> Connect wallet
              </button>
            )}
          </div>
          <div className="dbanner-body">
            <div>
              <div className="label" style={{ color: "rgba(13,13,12,.6)" }}>{BANNER[tab].label}</div>
              <h1 className="dbanner-h">{BANNER[tab].title}</h1>
              <p className="dbanner-p">{BANNER[tab].sub}</p>
            </div>
            <CandyIcon kind={BANNER[tab].kind} size={132} />
          </div>
        </div>
        {tab === "overview" && (
          <>
            <div className="stats">
              <Stat label="RPC providers" value={DEFAULT_RPCS.length} sub="must agree at one block" />
              <Stat label="Exit list" value={trust?.source === "registry" ? "Registry" : "Built-in"} sub={trust?.source === "registry" ? "read from chain" : "shipped in this kit"} />
              <Stat
                label="Protocol alarm"
                value={trust?.status ?? "Not set"}
                tone={trust?.status ? (alarm ? "bad" : "ok") : undefined}
                sub={trust?.statusNote || (trust?.status ? "from the watcher" : "no registry connected")}
              />
              <Stat label="Wallet" value={wallet ? "Connected" : "Not connected"} tone={wallet ? "ok" : undefined} sub={wallet ? short(wallet) : "connect to sign"} />
            </div>

            <div className="duo">
              <section className="card" style={{ margin: 0 }}>
                <div className="label">Network health</div>
                <p className="muted small" style={{ margin: "4px 0 10px" }}>Live reads from each provider Evac uses.</p>
                {(health ?? DEFAULT_RPCS.map((url): Health => ({ url, ms: null, height: -1 }))).map((h) => (
                  <div className="health-row" key={h.url}>
                    <span className={`hdot ${h.height === -1 ? "wait" : h.ms === null ? "down" : "up"}`} />
                    <span className="mono grow">{h.url.replace("https://", "")}</span>
                    <span className="muted small">
                      {h.height === -1 ? "checking…" : h.ms === null ? "unreachable" : `${h.ms} ms · block ${h.height?.toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </section>

              <section className="card" style={{ margin: 0 }}>
                <div className="label">Ready for an emergency?</div>
                {(() => {
                  const items: [string, boolean][] = [
                    ["Wallet connected", wallet !== null],
                    ["Account scanned", scan?.position != null],
                    ["Guard approved the plan", !!scan?.plan && scan.plan.steps.length > 0 && scan.plan.steps.every((s) => checkTx(s.tx, manifest, scan.position!.accountId).ok)],
                    ["Tokens registered for withdrawal", !!scan && scan.storage.length === 0 && scan.position != null],
                    ["Exit list read from the registry", trust?.source === "registry"],
                  ];
                  const done = items.filter(([, ok]) => ok).length;
                  return (
                    <>
                      <div className="meter" aria-label={`${done} of ${items.length} ready`}>
                        <i style={{ width: `${(done / items.length) * 100}%` }} />
                      </div>
                      {items.map(([t, ok]) => (
                        <div className="check-row" key={t}>
                          <span className={`tick ${ok ? "on" : ""}`}>{ok ? "✓" : ""}</span>
                          <span className={ok ? "" : "muted"}>{t}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </section>
            </div>

            <section className="card">
              <div className="card-head">
                <span className="badge-icon"><IconSearch /></span>
                <div>
                  <div className="label">Quick scan</div>
                  <h2>Check an account</h2>
                </div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input
                  className="mono-input"
                  placeholder="your-account.near"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy) {
                      setTab("exit");
                      run();
                    }
                  }}
                  aria-label="NEAR account"
                />
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => {
                    setTab("exit");
                    run();
                  }}
                >
                  Scan
                </button>
              </div>
            </section>

            {pos && (
              <section className="card">
                <div className="label">Last scan</div>
                <div className="stats" style={{ marginTop: 10 }}>
                  <Stat label="Supplied" value={pos.supplied.length} sub="tokens" />
                  <Stat label="Collateral" value={pos.collateral.length} sub="tokens" />
                  <Stat label="Borrowed" value={pos.borrowed.length} tone={pos.borrowed.length ? "warn" : undefined} sub="tokens" />
                  <Stat label="Exit plan" value={scan?.plan?.kind ?? "none"} tone={scan?.plan?.kind === "full" ? "ok" : "warn"} sub={`block ${scan?.block}`} />
                </div>
              </section>
            )}

            <section className="card" style={{ padding: 0 }}>
              <div style={{ padding: "16px 20px 6px" }}>
                <div className="label">Protocols</div>
              </div>
              {PROTOCOLS.map((p) => (
                <div className="proto-row" key={p.id}>
                  <ProtocolIcon id={p.id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{p.name}</b>
                    <div className="muted small mono">{p.note}</div>
                  </div>
                  <span className={`chip ${p.status === "Supported" ? "ok-chip" : "warn-chip"}`}>{p.status}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "exit" && (
          <>
            <Stepper phase={phase} />
            <section className="card">
              <div className="card-head">
                <span className="badge-icon"><IconSearch /></span>
                <div>
                  <div className="label">Step 1</div>
                  <h2>Find your Burrow position</h2>
                </div>
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input
                  className="mono-input"
                  placeholder="your-account.near"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && run()}
                  aria-label="NEAR account"
                />
                <button className="btn primary" onClick={run} disabled={busy}>
                  Scan
                </button>
              </div>
              {status && <p className="small" style={{ margin: "12px 0 0", color: "var(--accent)" }}>{status}</p>}
              {error && (
                <div className="notice bad-notice" style={{ marginTop: 12 }} role="alert">
                  <span className="bad"><IconAlert /></span>
                  <span>{error}</span>
                </div>
              )}
            </section>

            {report && (
              <section className="card">
                <Report r={report} />
              </section>
            )}
            {report?.recovered && wallet && <Bridge wallet={wallet} report={report} />}

            {scan && (
              <section className="card">
                <div className="card-head">
                  <span className="badge-icon"><ProtocolIcon id="burrow" size={26} /></span>
                  <div>
                    <div className="label">Step 2</div>
                    <h2>Your position</h2>
                  </div>
                </div>
                <p className="muted small">
                  Read at block {scan.block}. {scan.providers} RPC providers agreed{scan.failed ? `, ${scan.failed} unavailable` : ""}.
                </p>
                {!scan.position ? (
                  <p>No Burrow account found for this name.</p>
                ) : (
                  <>
                    <Group title="Supplied (not collateral)" rows={scan.position.supplied} />
                    <Group title="Collateral" rows={scan.position.collateral} />
                    <Group title="Borrowed" rows={scan.position.borrowed} />

                    {scan.plan && (
                      <div className="stack" style={{ marginTop: 20 }}>
                        <div className="row">
                          <h3>Exit plan</h3>
                          <span className={`chip ${scan.plan.kind === "full" ? "ok-chip" : "warn-chip"}`}>{scan.plan.kind}</span>
                        </div>
                        {scan.plan.notes.map((n, i) => (
                          <div key={i} className="notice warn-notice">
                            <span className="warn"><IconInfo /></span>
                            <span>{n}</span>
                          </div>
                        ))}
                        {scan.storage.map((n, i) => (
                          <div key={`st${i}`} className="notice warn-notice">
                            <span className="warn"><IconAlert /></span>
                            <span>{n}</span>
                          </div>
                        ))}
                        {scan.plan.steps.map((s, i) => (
                          <div key={i} className="stack">
                            <p style={{ margin: 0, fontWeight: 650 }}>{s.title}</p>
                            <Verdict v={checkTx(s.tx, manifest, scan.position!.accountId)} />
                            <div className="row">
                              <button className="btn primary" disabled={busy || !mine} onClick={() => exitNow(s, scan.plan!)}>
                                <IconExit /> Sign and exit
                              </button>
                              {!mine && (
                                <span className="muted small">
                                  {wallet ? "Your connected wallet is a different account than the one scanned." : "Connect the wallet that owns this account to sign."}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {tab === "check" && (
          <section className="card">
            <p className="muted">
              Paste the transaction a site is asking you to sign. The sample is what a hijacked frontend might try: adding itself a
              full-access key to your account.
            </p>
            <textarea className="mono-input" value={txText} onChange={(e) => setTxText(e.target.value)} aria-label="Transaction JSON" />
            <div className="row" style={{ margin: "12px 0" }}>
              <button className="btn primary" onClick={checkPasted}>
                <IconShield /> Check it
              </button>
            </div>
            {txVerdict && <Verdict v={txVerdict} />}
          </section>
        )}

        {tab === "registry" && (
          <>
            {!trust?.entry ? (
              <section className="card">
                <div className="notice info-notice">
                  <span><IconInfo /></span>
                  <span>
                    No on-chain registry is connected yet, so Evac is using the exit list built into this kit. Once the registry contract is
                    deployed and its account set in <span className="mono">NEXT_PUBLIC_REGISTRY_ID</span>, its release hash, site fingerprint,
                    alarm and blocklist appear here.
                  </span>
                </div>
              </section>
            ) : (
              <section className="card">
                <div className="stats">
                  <Stat label="Alarm" value={trust.entry.status} tone={trust.entry.status === "Ok" ? "ok" : "bad"} sub={trust.entry.status_note || "no note"} />
                  <Stat label="Blocklist" value={trust.entry.blocklist.length} sub="look-alike domains" />
                  <Stat label="Release" value={trust.entry.release ? "Published" : "None"} sub={trust.entry.release ? trust.entry.release.slice(0, 22) + "…" : "no kit hash yet"} />
                  <Stat label="Official site" value={trust.entry.url ? "Set" : "None"} sub={trust.entry.url} />
                </div>
              </section>
            )}

            <section className="card" style={{ padding: 0 }}>
              <div style={{ padding: "16px 20px 6px" }}>
                <div className="label">Exit list in use ({trust?.source === "registry" ? "from registry" : "built in"})</div>
              </div>
              {Object.entries(manifest.contracts).map(([id, c]) => (
                <div className="proto-row" key={id}>
                  <ProtocolIcon id="burrow" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="mono">{id}</b>
                    <div className="muted small">allowed methods: {c.methods.join(", ")}</div>
                  </div>
                  <span className="chip ok-chip">withdraw only</span>
                </div>
              ))}
            </section>

            {trust && trust.warnings.length > 0 && (
              <section className="card stack">
                {trust.warnings.map((w, i) => (
                  <div key={i} className="notice warn-notice">
                    <span className="warn"><IconAlert /></span>
                    <span>{w}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

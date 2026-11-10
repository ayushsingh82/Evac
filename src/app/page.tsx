"use client";

import { useCallback, useEffect, useState } from "react";
import { planExit, scanBurrow, withdrawnTokens } from "@/lib/burrow";
import { checkTx } from "@/lib/guard";
import Bridge from "./Bridge";
import { BURROW_MANIFEST } from "@/lib/manifest";
import { loadTrustedManifest, type TrustedManifest } from "@/lib/registry";
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

type Scan = { position: Position | null; plan: ExitPlan | null; block: number; providers: number; failed: number; storage: string[] };
type Pending = { account: string; before: Balances; expected: string[] };

const PENDING_KEY = "evac.pending-exit";

function Rows({ title, rows }: { title: string; rows: { token_id: string; balance: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-400">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">none</p>
      ) : (
        <ul className="font-mono text-xs break-all">
          {rows.map((r) => (
            <li key={r.token_id}>
              {r.token_id}: {r.balance}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Verdict({ v }: { v: GuardVerdict }) {
  return (
    <div className={`rounded border p-3 text-sm ${v.ok ? "border-emerald-600 bg-emerald-950/40" : "border-red-600 bg-red-950/40"}`}>
      <p className="font-semibold">{v.ok ? "Guard: safe exit transaction" : "Guard: REFUSED"}</p>
      <ul className="mt-1 list-disc pl-5">
        {(v.ok ? v.explain : v.reasons).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Report({ r }: { r: ExitReport }) {
  return (
    <div className={`rounded border p-3 text-sm ${r.recovered ? "border-emerald-500 bg-emerald-950/50" : "border-amber-500 bg-amber-950/40"}`}>
      <p className="text-base font-semibold">{r.recovered ? "Recovered. The money is back in your wallet." : "Not confirmed as recovered."}</p>
      <ul className="mt-2 font-mono text-xs break-all">
        {r.deltas.map((d) => (
          <li key={d.token}>
            {d.gained ? "✓" : "✗"} {d.token}: {d.before} → {d.after}
          </li>
        ))}
      </ul>
      {r.failures.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-amber-300">
          {r.failures.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SAMPLE_BAD = JSON.stringify(
  {
    signerId: "you.near",
    receiverId: "you.near",
    actions: [{ type: "AddKey", publicKey: "ed25519:attacker", accessKey: { permission: "FullAccess" } }],
  },
  null,
  2,
);

export default function Home() {
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
      setScan({
        position,
        plan,
        storage,
        block: quorum.block.height,
        providers: quorum.agreed.length,
        failed: quorum.failed.length,
      });
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Evac</h1>
        <p className="text-lg text-emerald-400">Evacuate your DeFi when the website can&apos;t be trusted.</p>
        <p className="mt-2 text-zinc-400">
          A fire exit for NEAR DeFi. If a protocol&apos;s website is down or hijacked, your funds are still in its
          contracts. This page reads them directly and builds a checked withdrawal. No server of ours is involved.
        </p>
        <div className="mt-3 flex items-center gap-3 text-sm">
          {wallet ? (
            <>
              <span className="font-mono">Wallet: {wallet}</span>
              <button className="underline" onClick={() => disconnect().then(() => setWallet(null))}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="rounded bg-zinc-200 px-3 py-1.5 font-semibold text-zinc-900" onClick={() => openConnect()}>
              Connect wallet
            </button>
          )}
        </div>
      </header>

      {trust && (
        <div className={`rounded border p-3 text-sm ${trust.status && trust.status !== "Ok" ? "border-red-600 bg-red-950/40" : "border-zinc-700"}`}>
          <p className="font-semibold">
            Exit list from: {trust.source === "registry" ? "the on-chain registry" : "this kit (built-in)"}
            {trust.status ? ` · alarm: ${trust.status}` : ""}
          </p>
          {trust.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-amber-300">
              {trust.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">1. Scan your Burrow position</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-zinc-700 bg-transparent px-3 py-2 font-mono text-sm"
            placeholder="your-account.near"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <button
            className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            onClick={run}
            disabled={busy}
          >
            Scan
          </button>
        </div>
        {status && <p className="text-sm text-sky-400">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {report && <Report r={report} />}
        {report?.recovered && wallet && <Bridge wallet={wallet} report={report} />}
        {scan && (
          <div className="flex flex-col gap-4 rounded border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">
              Read at block {scan.block}. {scan.providers} providers agreed
              {scan.failed ? `, ${scan.failed} unavailable` : ""}.
            </p>
            {!scan.position ? (
              <p>No Burrow account found for this name.</p>
            ) : (
              <>
                <Rows title="Supplied (not collateral)" rows={scan.position.supplied} />
                <Rows title="Collateral" rows={scan.position.collateral} />
                <Rows title="Borrowed" rows={scan.position.borrowed} />
                {scan.plan && (
                  <div className="flex flex-col gap-3">
                    <h3 className="font-semibold">Exit plan: {scan.plan.kind}</h3>
                    {scan.plan.notes.map((n, i) => (
                      <p key={i} className="text-sm text-amber-400">
                        {n}
                      </p>
                    ))}
                    {scan.storage.map((n, i) => (
                      <p key={`st${i}`} className="text-sm text-amber-400">
                        {n}
                      </p>
                    ))}
                    {scan.plan.steps.map((s, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <p className="text-sm font-medium">{s.title}</p>
                        <Verdict v={checkTx(s.tx, manifest, scan.position!.accountId)} />
                        <button
                          className="self-start rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                          disabled={busy || !mine}
                          onClick={() => exitNow(s, scan.plan!)}
                        >
                          Sign and exit
                        </button>
                        {!mine && (
                          <p className="text-xs text-zinc-500">
                            {wallet
                              ? "Your connected wallet is a different account than the one scanned, so signing is off."
                              : "Connect the wallet that owns this account to sign."}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">2. Check a transaction from a site you don&apos;t trust</h2>
        <p className="text-sm text-zinc-400">
          Paste the transaction a website is asking you to sign. The sample below is what a hijacked frontend might
          try: adding itself a full-access key to your account.
        </p>
        <textarea
          className="h-48 rounded border border-zinc-700 bg-transparent p-3 font-mono text-xs"
          value={txText}
          onChange={(e) => setTxText(e.target.value)}
        />
        <button className="self-start rounded bg-zinc-200 px-4 py-2 font-semibold text-zinc-900" onClick={checkPasted}>
          Check it
        </button>
        {txVerdict && <Verdict v={txVerdict} />}
      </section>
    </main>
  );
}

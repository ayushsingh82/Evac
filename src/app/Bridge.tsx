"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bridgeTransferTx,
  destinationChoices,
  fetchSwapStatus,
  fetchTokens,
  findNearAsset,
  requestQuote,
  validRecipient,
  type OneClickToken,
  type QuoteResponse,
  type SwapStatus,
} from "@/lib/intents";
import type { ExitReport } from "@/lib/verify";
import { GuardRefusedError, signBridge } from "@/lib/wallet";
import { IconBridge } from "./icons";

/** Optional last step: send what you recovered to another chain through NEAR Intents. */
export default function Bridge({ wallet, report }: { wallet: string; report: ExitReport }) {
  const [tokens, setTokens] = useState<OneClickToken[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tokenIdx, setTokenIdx] = useState(0);
  const [destId, setDestId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTokens().then(setTokens, (e) => setLoadErr(String(e)));
  }, []);

  const options = useMemo(() => {
    if (!tokens) return [];
    return report.deltas
      .filter((d) => d.gained)
      .map((d) => ({
        token: d.token,
        amount: (BigInt(d.after) - BigInt(d.before)).toString(),
        asset: findNearAsset(tokens, d.token),
      }));
  }, [tokens, report]);

  const dests = useMemo(() => (tokens ? destinationChoices(tokens) : []), [tokens]);
  const dest = dests.find((d) => d.assetId === destId) ?? dests[0];
  const opt = options[tokenIdx];

  if (loadErr) return <section className="card"><p className="warn small" style={{ margin: 0 }}>Bridge is unavailable right now: {loadErr}</p></section>;
  if (!tokens) return <section className="card"><p className="muted small" style={{ margin: 0 }}>Loading bridge options…</p></section>;
  if (!options.some((o) => o.asset)) {
    return <section className="card"><p className="muted small" style={{ margin: 0 }}>None of the recovered tokens can be bridged through NEAR Intents.</p></section>;
  }

  const input = () => {
    if (!opt?.asset || !dest) throw new Error("Pick a token and a destination.");
    if (!validRecipient(dest.blockchain, recipient.trim())) throw new Error(`That is not a valid ${dest.blockchain} address.`);
    return {
      nearToken: opt.token,
      amount: opt.amount,
      refundTo: wallet,
      recipient: recipient.trim(),
      destinationAsset: dest.assetId,
    };
  };

  async function preview() {
    setBusy(true);
    setError(null);
    setQuote(null);
    try {
      setQuote(await requestQuote({ ...input(), dry: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function bridge() {
    setBusy(true);
    setError(null);
    try {
      const real = await requestQuote({ ...input(), dry: false });
      const deposit = real.quote.depositAddress!;
      setStatus(`Sending to deposit address ${deposit}…`);
      const tx = bridgeTransferTx(wallet, opt.token, deposit, opt.amount);
      await signBridge(tx, { signerId: wallet, nearToken: opt.token, depositAddress: deposit, amount: opt.amount });
      for (let i = 0; i < 40; i++) {
        const s: SwapStatus = await fetchSwapStatus(deposit, real.quote.depositMemo);
        setStatus(`Swap status: ${s}`);
        if (["SUCCESS", "REFUNDED", "FAILED"].includes(s)) break;
        await new Promise((r) => setTimeout(r, 5000));
      }
    } catch (e) {
      setStatus(null);
      setError(e instanceof GuardRefusedError ? "Refused by the Bridge Guard: " + e.verdict.reasons.join(" ") : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <span className="badge-icon"><IconBridge /></span>
        <div>
          <div className="label">Optional</div>
          <h2>Send it to another chain</h2>
        </div>
      </div>
      <div className="stack">
      <div className="row">
        <select style={{ width: "auto" }} value={tokenIdx} onChange={(e) => setTokenIdx(Number(e.target.value))}>
          {options.map((o, i) => (
            <option key={o.token} value={i} disabled={!o.asset} className="text-black">
              {o.token} ({o.amount}){o.asset ? "" : " - not bridgeable"}
            </option>
          ))}
        </select>
        <select style={{ width: "auto" }} value={dest?.assetId} onChange={(e) => setDestId(e.target.value)}>
          {dests.map((d) => (
            <option key={d.assetId} value={d.assetId} className="text-black">
              USDC on {d.blockchain}
            </option>
          ))}
        </select>
        <input
          className="mono-input" style={{ flex: 1, minWidth: 240 }}
          placeholder="destination address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>
      <div className="row">
        <button className="btn ghost" disabled={busy} onClick={preview}>
          Preview
        </button>
        <button className="btn primary" disabled={busy || !quote} onClick={bridge}>
          Bridge
        </button>
      </div>
      {quote && (
        <p className="small" style={{ margin: 0 }}>
          You send {quote.quote.amountInFormatted} (about ${quote.quote.amountInUsd ?? "?"}) and receive about{" "}
          {quote.quote.amountOutFormatted} USDC (at least {quote.quote.minAmountOut} base units). The transfer is checked by the
          Bridge Guard: only that exact amount to the quoted deposit address.
        </p>
      )}
      {status && <p className="small" style={{ margin: 0, color: "var(--accent)" }}>{status}</p>}
      {error && <p className="small bad" style={{ margin: 0 }}>{error}</p>}
      </div>
    </section>
  );
}

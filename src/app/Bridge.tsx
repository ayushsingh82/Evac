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

  if (loadErr) return <p className="text-sm text-amber-400">Bridge is unavailable right now: {loadErr}</p>;
  if (!tokens) return <p className="text-sm text-zinc-500">Loading bridge options…</p>;
  if (!options.some((o) => o.asset)) {
    return <p className="text-sm text-zinc-500">None of the recovered tokens can be bridged through NEAR Intents.</p>;
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
    <div className="flex flex-col gap-3 rounded border border-zinc-800 p-4">
      <h3 className="font-semibold">Optional: send it to another chain</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        <select className="rounded border border-zinc-700 bg-transparent p-2" value={tokenIdx} onChange={(e) => setTokenIdx(Number(e.target.value))}>
          {options.map((o, i) => (
            <option key={o.token} value={i} disabled={!o.asset} className="text-black">
              {o.token} ({o.amount}){o.asset ? "" : " - not bridgeable"}
            </option>
          ))}
        </select>
        <select className="rounded border border-zinc-700 bg-transparent p-2" value={dest?.assetId} onChange={(e) => setDestId(e.target.value)}>
          {dests.map((d) => (
            <option key={d.assetId} value={d.assetId} className="text-black">
              USDC on {d.blockchain}
            </option>
          ))}
        </select>
        <input
          className="min-w-64 flex-1 rounded border border-zinc-700 bg-transparent p-2 font-mono text-xs"
          placeholder="destination address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button className="rounded bg-zinc-200 px-3 py-1.5 font-semibold text-zinc-900 disabled:opacity-50" disabled={busy} onClick={preview}>
          Preview
        </button>
        <button className="rounded bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50" disabled={busy || !quote} onClick={bridge}>
          Bridge
        </button>
      </div>
      {quote && (
        <p className="text-sm">
          You send {quote.quote.amountInFormatted} (about ${quote.quote.amountInUsd ?? "?"}) and receive about{" "}
          {quote.quote.amountOutFormatted} USDC (at least {quote.quote.minAmountOut} base units). The transfer is checked by the
          Bridge Guard: only that exact amount to the quoted deposit address.
        </p>
      )}
      {status && <p className="text-sm text-sky-400">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

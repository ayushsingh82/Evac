// "Recovered" means two things at once: every receipt in the transaction succeeded, AND the balance went up.
// NEAR transactions are asynchronous. The first receipt can succeed while a later one (for example the token
// transfer) fails, and Burrow then re-credits the deposit. Checking only the top-level status would lie.

import { DEFAULT_RPCS, quorumView, rpcCall, type RpcOptions } from "./rpc";

/** The parts of a NEAR final execution outcome we read. */
export interface OutcomeLike {
  status?: unknown;
  transaction_outcome?: { id?: string; outcome?: { status?: unknown } };
  receipts_outcome?: { id?: string; outcome?: { status?: unknown; executor_id?: string } }[];
}

const isFailure = (s: unknown): boolean => !!s && typeof s === "object" && "Failure" in (s as object);

function failureText(s: unknown): string {
  try {
    return JSON.stringify((s as { Failure: unknown }).Failure);
  } catch {
    return "unknown failure";
  }
}

/** Every failure found anywhere in the transaction, in plain strings. Empty means all receipts succeeded. */
export function outcomeFailures(o: OutcomeLike | null | undefined): string[] {
  if (!o) return ["No transaction outcome was returned."];
  const out: string[] = [];
  if (isFailure(o.status)) out.push(`Transaction failed: ${failureText(o.status)}`);
  if (isFailure(o.transaction_outcome?.outcome?.status)) {
    out.push(`Transaction receipt failed: ${failureText(o.transaction_outcome?.outcome?.status)}`);
  }
  for (const r of o.receipts_outcome ?? []) {
    if (isFailure(r.outcome?.status)) {
      out.push(`A step on ${r.outcome?.executor_id ?? "a contract"} failed: ${failureText(r.outcome?.status)}`);
    }
  }
  // A transaction with no recognisable success status is not a success.
  if (out.length === 0 && o.status === undefined) out.push("The outcome has no status, so it cannot be trusted.");
  return out;
}

export type Balances = Record<string, string>;

export async function snapshotBalances(accountId: string, tokens: string[], o: RpcOptions = {}): Promise<Balances> {
  const out: Balances = {};
  for (const t of tokens) {
    try {
      const r = await quorumView<string>(t, "ft_balance_of", { account_id: accountId }, o);
      out[t] = String(r.value);
    } catch {
      out[t] = "unknown";
    }
  }
  return out;
}

export interface TokenDelta {
  token: string;
  before: string;
  after: string;
  gained: boolean;
}

export interface ExitReport {
  recovered: boolean;
  failures: string[];
  deltas: TokenDelta[];
}

const big = (s: string): bigint | null => (/^\d+$/.test(s) ? BigInt(s) : null);

export function evaluateExit(failures: string[], before: Balances, after: Balances, expected: string[]): ExitReport {
  const deltas: TokenDelta[] = expected.map((token) => {
    const b = big(before[token] ?? "");
    const a = big(after[token] ?? "");
    return { token, before: before[token] ?? "unknown", after: after[token] ?? "unknown", gained: b !== null && a !== null && a > b };
  });
  const notes = [...failures];
  for (const d of deltas) {
    if (!d.gained) {
      notes.push(
        `${d.token}: your balance did not go up. The protocol may have returned the deposit because the token transfer failed (often the account is not registered with that token).`,
      );
    }
  }
  return { recovered: failures.length === 0 && deltas.every((d) => d.gained), failures: notes, deltas };
}

/** Fetch a finished transaction's outcome (used when a redirect wallet sends the user back with ?transactionHashes=). */
export async function fetchTxOutcome(txHash: string, signerId: string, o: RpcOptions = {}): Promise<OutcomeLike> {
  const rpcs = o.rpcs ?? DEFAULT_RPCS;
  let last: unknown;
  for (const url of rpcs) {
    try {
      return await rpcCall<OutcomeLike>(
        url,
        "EXPERIMENTAL_tx_status",
        { tx_hash: txHash, sender_account_id: signerId, wait_until: "FINAL" },
        { ...o, timeoutMs: 30_000 },
      );
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`Could not fetch the transaction outcome: ${String(last)}`);
}

/** After a successful send, balances settle a few seconds later. Poll until every expected token rose, or give up. */
export async function waitForGain(
  accountId: string,
  before: Balances,
  expected: string[],
  o: RpcOptions & { tries?: number; delayMs?: number } = {},
): Promise<Balances> {
  const tries = o.tries ?? 8;
  const delay = o.delayMs ?? 2500;
  let after: Balances = {};
  for (let i = 0; i < tries; i++) {
    after = await snapshotBalances(accountId, expected, o);
    const done = expected.every((t) => {
      const b = big(before[t] ?? "");
      const a = big(after[t] ?? "");
      return b !== null && a !== null && a > b;
    });
    if (done) break;
    await new Promise((r) => setTimeout(r, delay));
  }
  return after;
}

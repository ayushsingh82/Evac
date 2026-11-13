// NEAR RPC reads through a quorum: several providers, one pinned block, answers must agree.
// A dead provider is tolerated. A provider that disagrees stops the read, so we never act on a wrong answer.

import type { PinnedBlock, QuorumResult } from "./types";

// Four independent operators. At least two must answer a read and every answer must match. A throttled or
// unreachable provider is tolerated; rpc.mainnet.near.org in particular is rate-limited under load.
export const DEFAULT_RPCS = [
  "https://free.rpc.fastnear.com",
  "https://near.drpc.org",
  "https://rpc.shitzuapes.xyz",
  "https://rpc.mainnet.near.org",
];

/** Testnet providers, used only to read a registry deployed on testnet (NEXT_PUBLIC_REGISTRY_NETWORK=testnet). */
export const TESTNET_RPCS = ["https://rpc.testnet.near.org", "https://test.rpc.fastnear.com"];

export class QuorumError extends Error {
  constructor(
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "QuorumError";
  }
}

export interface RpcOptions {
  rpcs?: string[];
  timeoutMs?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
}

export async function rpcCall<T>(url: string, method: string, params: unknown, o: RpcOptions): Promise<T> {
  const f = o.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 12_000);
  try {
    const res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "evac", method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: unknown };
    if (json.error || json.result === undefined) throw new Error(`rpc error: ${JSON.stringify(json.error ?? json)}`);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

interface BlockResult {
  header: { height: number; hash: string };
}

type Pinned = { block: PinnedBlock; ok: string[]; failed: string[] };
let pinCache: { at: number; key: string; value: Pinned } | null = null;
const PIN_TTL_MS = 4000;

/** Pick one block height every responding provider can serve: the lowest "final" height seen. */
export async function pinBlock(o: RpcOptions = {}): Promise<Pinned> {
  const rpcs = o.rpcs ?? DEFAULT_RPCS;
  // Reuse a very recent pin on the real network, so one scan does not re-pin for every read. Tests inject fetch and skip this.
  const key = rpcs.join(",");
  if (!o.fetchImpl && pinCache && pinCache.key === key && Date.now() - pinCache.at < PIN_TTL_MS) return pinCache.value;
  const fresh = await pinFresh(o, rpcs);
  if (!o.fetchImpl) pinCache = { at: Date.now(), key, value: fresh };
  return fresh;
}

async function pinFresh(o: RpcOptions, rpcs: string[]): Promise<Pinned> {
  const settled = await Promise.allSettled(
    rpcs.map((u) => rpcCall<BlockResult>(u, "block", { finality: "final" }, o)),
  );
  const ok: string[] = [];
  const failed: string[] = [];
  let low: { height: number; hash: string } | undefined;
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      ok.push(rpcs[i]);
      const h = s.value.header;
      if (!low || h.height < low.height) low = { height: h.height, hash: h.hash };
    } else failed.push(rpcs[i]);
  });
  if (!low || ok.length < 2) {
    throw new QuorumError(`Need at least 2 working RPC providers, got ${ok.length}`, { failed });
  }
  // Step back a few blocks so slower providers have it.
  const height = low.height - 3;
  return { block: { height, hash: "" }, ok, failed };
}

interface CallFunctionResult {
  result: number[];
}

/** Stable JSON for comparing answers from different providers. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Call a contract view method at one pinned block on every provider; all answers must be identical. */
export async function quorumView<T>(
  contractId: string,
  methodName: string,
  args: unknown,
  o: RpcOptions = {},
): Promise<QuorumResult<T>> {
  const { block, ok: live, failed: pinFailed } = await pinBlock(o);
  const argsBase64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(JSON.stringify(args)).toString("base64")
      : btoa(JSON.stringify(args));
  const params = {
    request_type: "call_function",
    block_id: block.height,
    account_id: contractId,
    method_name: methodName,
    args_base64: argsBase64,
  };
  const settled = await Promise.allSettled(live.map((u) => rpcCall<CallFunctionResult>(u, "query", params, o)));
  const answers: { url: string; value: T; key: string }[] = [];
  const failed = [...pinFailed];
  const contractErrors: string[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled" && !Array.isArray((s.value as { result?: unknown }).result)) {
      // The node answered, but the call itself failed (for example: no contract on that account).
      const err = (s.value as { error?: unknown }).error;
      contractErrors.push(typeof err === "string" ? err : "the contract call returned no result");
      failed.push(live[i]);
    } else if (s.status === "fulfilled") {
      const text = new TextDecoder().decode(Uint8Array.from(s.value.result));
      const value = JSON.parse(text) as T;
      answers.push({ url: live[i], value, key: canonical(value) });
    } else failed.push(live[i]);
  });
  if (answers.length < 2 && contractErrors.length >= 2) {
    throw new QuorumError(`The contract call failed on every provider: ${contractErrors[0]}`, { failed });
  }
  if (answers.length < 2) {
    throw new QuorumError(`Only ${answers.length} provider answered the read; need 2`, { failed });
  }
  const first = answers[0].key;
  const mismatch = answers.filter((a) => a.key !== first);
  if (mismatch.length) {
    throw new QuorumError("RPC providers disagree about the same block. Stopping instead of guessing.", {
      providers: answers.map((a) => a.url),
    });
  }
  return { value: answers[0].value, block, agreed: answers.map((a) => a.url), failed };
}

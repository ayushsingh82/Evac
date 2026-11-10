// NEAR RPC reads through a quorum: several providers, one pinned block, answers must agree.
// A dead provider is tolerated. A provider that disagrees stops the read, so we never act on a wrong answer.

import type { PinnedBlock, QuorumResult } from "./types";

export const DEFAULT_RPCS = [
  "https://rpc.mainnet.near.org",
  "https://free.rpc.fastnear.com",
  "https://near.drpc.org",
];

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

/** Pick one block height every responding provider can serve: the lowest "final" height seen. */
export async function pinBlock(o: RpcOptions = {}): Promise<{ block: PinnedBlock; ok: string[]; failed: string[] }> {
  const rpcs = o.rpcs ?? DEFAULT_RPCS;
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
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      const text = new TextDecoder().decode(Uint8Array.from(s.value.result));
      const value = JSON.parse(text) as T;
      answers.push({ url: live[i], value, key: canonical(value) });
    } else failed.push(live[i]);
  });
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

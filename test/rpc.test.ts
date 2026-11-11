import { describe, expect, it } from "vitest";
import { QuorumError, quorumView } from "../src/lib/rpc";

const RPCS = ["https://a", "https://b", "https://c"];

function bytes(v: unknown): number[] {
  return Array.from(new TextEncoder().encode(JSON.stringify(v)));
}

/** Fake fetch: answers `block` with a height, `query` with the per-provider value or an error. */
function fake(answers: Record<string, unknown | "DOWN">, heights: Record<string, number> = {}) {
  return (async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const a = answers[url];
    if (a === "DOWN") throw new Error("connection refused");
    const result =
      body.method === "block"
        ? { header: { height: heights[url] ?? 1000, hash: "h" } }
        : { result: bytes(a) };
    return { ok: true, status: 200, json: async () => ({ result }) } as Response;
  }) as unknown as typeof fetch;
}

describe("quorumView", () => {
  it("returns the value when all providers agree, key order does not matter", async () => {
    const r = await quorumView("c.near", "get", {}, {
      rpcs: RPCS,
      fetchImpl: fake({ "https://a": { x: 1, y: 2 }, "https://b": { y: 2, x: 1 }, "https://c": { x: 1, y: 2 } }),
    });
    expect(r.value).toEqual({ x: 1, y: 2 });
    expect(r.agreed).toHaveLength(3);
    expect(r.failed).toHaveLength(0);
  });

  it("tolerates one dead provider and reports it", async () => {
    const r = await quorumView("c.near", "get", {}, {
      rpcs: RPCS,
      fetchImpl: fake({ "https://a": { ok: true }, "https://b": { ok: true }, "https://c": "DOWN" }),
    });
    expect(r.agreed).toHaveLength(2);
    expect(r.failed).toEqual(["https://c"]);
  });

  it("stops when providers disagree", async () => {
    await expect(
      quorumView("c.near", "get", {}, {
        rpcs: RPCS,
        fetchImpl: fake({ "https://a": { bal: "100" }, "https://b": { bal: "999" }, "https://c": { bal: "100" } }),
      }),
    ).rejects.toBeInstanceOf(QuorumError);
  });

  it("stops when fewer than two providers work", async () => {
    await expect(
      quorumView("c.near", "get", {}, {
        rpcs: RPCS,
        fetchImpl: fake({ "https://a": { ok: 1 }, "https://b": "DOWN", "https://c": "DOWN" }),
      }),
    ).rejects.toBeInstanceOf(QuorumError);
  });

  it("pins to the lowest height so slower providers can serve it", async () => {
    const r = await quorumView("c.near", "get", {}, {
      rpcs: RPCS,
      fetchImpl: fake(
        { "https://a": 1, "https://b": 1, "https://c": 1 },
        { "https://a": 1005, "https://b": 1000, "https://c": 1002 },
      ),
    });
    expect(r.block.height).toBe(997);
  });
});

describe("quorumView, contract call fails", () => {
  it("reports the contract's own error instead of crashing when every provider says the call failed", async () => {
    const f = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const result = body.method === "block" ? { header: { height: 1000, hash: "h" } } : { error: "MethodResolveError(MethodNotFound)" };
      return { ok: true, status: 200, json: async () => ({ result }) } as Response;
    }) as unknown as typeof fetch;
    await expect(quorumView("nope.near", "get", {}, { rpcs: RPCS, fetchImpl: f })).rejects.toThrow(/contract call failed.*MethodNotFound/);
  });
});

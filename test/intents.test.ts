import { describe, expect, it } from "vitest";
import {
  bridgeTransferTx,
  buildQuoteRequest,
  checkBridgeTx,
  destinationChoices,
  findNearAsset,
  requestQuote,
  validRecipient,
  type OneClickToken,
} from "../src/lib/intents";
import { checkStorage, storageWarnings } from "../src/lib/storage";

type FC = { methodName: string; deposit: string; args: Record<string, unknown> };
const fc = (t: { actions: unknown[] }) => t.actions[0] as FC;

const tokens: OneClickToken[] = [
  { assetId: "nep141:wrap.near", decimals: 24, blockchain: "near", symbol: "wNEAR" },
  { assetId: "nep141:usdt.tether-token.near", decimals: 6, blockchain: "near", symbol: "USDT" },
  { assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", decimals: 6, blockchain: "base", symbol: "USDC" },
  { assetId: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", decimals: 6, blockchain: "eth", symbol: "USDC" },
  { assetId: "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near", decimals: 6, blockchain: "eth", symbol: "USDT" },
];

describe("1Click helpers", () => {
  it("finds a NEAR token and rejects ones 1Click does not list", () => {
    expect(findNearAsset(tokens, "wrap.near")?.symbol).toBe("wNEAR");
    expect(findNearAsset(tokens, "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near")).toBeUndefined();
  });
  it("offers USDC destinations only", () => {
    expect(destinationChoices(tokens).map((t) => t.blockchain).sort()).toEqual(["base", "eth"]);
  });
  it("validates recipient addresses per chain", () => {
    expect(validRecipient("base", "0x2527D02599Ba641c19FEa793cD0F167589a0f10D")).toBe(true);
    expect(validRecipient("base", "0x123")).toBe(false);
    expect(validRecipient("base", "alice.near")).toBe(false);
    expect(validRecipient("sol", "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")).toBe(true);
    expect(validRecipient("unknown", "0x2527D02599Ba641c19FEa793cD0F167589a0f10D")).toBe(false);
  });
  it("builds a quote request in the shape the API expects", () => {
    const r = buildQuoteRequest({ nearToken: "wrap.near", amount: "5", refundTo: "alice.near", recipient: "0xabc", destinationAsset: "d", dry: true });
    expect(r).toMatchObject({ dry: true, swapType: "EXACT_INPUT", originAsset: "nep141:wrap.near", depositType: "ORIGIN_CHAIN", recipientType: "DESTINATION_CHAIN", refundTo: "alice.near" });
    expect(new Date(r.deadline).getTime()).toBeGreaterThan(Date.now());
  });
  it("refuses a bad amount", () => {
    for (const amount of ["0", "-1", "1.5", "", "abc"]) {
      expect(() => buildQuoteRequest({ nearToken: "wrap.near", amount, refundTo: "a.near", recipient: "0x", destinationAsset: "d", dry: true })).toThrow();
    }
  });
  it("requires a deposit address on a real (non-dry) quote", async () => {
    const f = (async () => ({ ok: true, status: 200, json: async () => ({ quote: { amountIn: "1", amountInFormatted: "1", amountOut: "1", amountOutFormatted: "1", minAmountOut: "1" } }) })) as unknown as typeof fetch;
    await expect(requestQuote({ nearToken: "wrap.near", amount: "5", refundTo: "a.near", recipient: "0x", destinationAsset: "d", dry: false }, { fetchImpl: f })).rejects.toThrow("deposit address");
  });
  it("surfaces API errors", async () => {
    const f = (async () => ({ ok: false, status: 400, json: async () => ({ message: "bad recipient" }) })) as unknown as typeof fetch;
    await expect(requestQuote({ nearToken: "wrap.near", amount: "5", refundTo: "a.near", recipient: "0x", destinationAsset: "d", dry: true }, { fetchImpl: f })).rejects.toThrow("bad recipient");
  });
});

describe("Bridge Guard", () => {
  const exp = { signerId: "alice.near", nearToken: "wrap.near", depositAddress: "dep0sit.near", amount: "5000" };
  const good = () => bridgeTransferTx("alice.near", "wrap.near", "dep0sit.near", "5000");

  it("accepts exactly the quoted transfer", () => {
    expect(checkBridgeTx(good(), exp).ok).toBe(true);
  });
  it("refuses a different recipient, amount, token, signer, method or deposit", () => {
    const variants: [string, (t: ReturnType<typeof good>) => void][] = [
      ["recipient", (t) => (fc(t).args.receiver_id = "evil.near")],
      ["amount", (t) => (fc(t).args.amount = "9999")],
      ["token", (t) => (t.receiverId = "other.near")],
      ["signer", (t) => (t.signerId = "bob.near")],
      ["method", (t) => (fc(t).methodName = "ft_transfer_call")],
      ["deposit", (t) => (fc(t).deposit = "0")],
      ["extra arg", (t) => (fc(t).args.msg = "x")],
      ["extra action", (t) => t.actions.push({ type: "Transfer", deposit: "1" })],
    ];
    for (const [name, mutate] of variants) {
      const t = good();
      mutate(t);
      expect(checkBridgeTx(t, exp).ok, name).toBe(false);
    }
  });
});

describe("storage pre-check", () => {
  const fake = (m: Record<string, unknown>) =>
    ({
      rpcs: ["https://a", "https://b"],
      fetchImpl: (async (url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        if (body.method === "block") return { ok: true, status: 200, json: async () => ({ result: { header: { height: 10, hash: "h" } } }) } as Response;
        const token = body.params.account_id as string;
        if (m[token] === "ERR") throw new Error("down");
        return { ok: true, status: 200, json: async () => ({ result: { result: Array.from(new TextEncoder().encode(JSON.stringify(m[token]))) } }) } as Response;
      }) as unknown as typeof fetch,
    });

  it("flags unregistered and unknown tokens", async () => {
    const c = await checkStorage("alice.near", ["a.near", "b.near", "c.near"], fake({ "a.near": { total: "1" }, "b.near": null, "c.near": "ERR" }));
    expect(c.map((x) => x.registered)).toEqual([true, false, "unknown"]);
    const w = storageWarnings(c);
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("b.near");
  });
});

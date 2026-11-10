import { describe, expect, it } from "vitest";
import { evaluateExit, outcomeFailures } from "../src/lib/verify";
import { GuardRefusedError, prepareGuarded, toWalletTx } from "../src/lib/wallet";
import { BURROW } from "../src/lib/manifest";
import type { NearTx } from "../src/lib/types";

const ok = { SuccessValue: "" };
const outcome = (top: unknown, receipts: unknown[]) => ({
  status: top,
  transaction_outcome: { outcome: { status: { SuccessReceiptId: "x" } } },
  receipts_outcome: receipts.map((s, i) => ({ id: `r${i}`, outcome: { status: s, executor_id: `c${i}.near` } })),
});

describe("outcomeFailures", () => {
  it("is empty when every receipt succeeded", () => {
    expect(outcomeFailures(outcome(ok, [{ SuccessReceiptId: "a" }, ok]))).toEqual([]);
  });

  it("catches a failed receipt even when the top-level status is success", () => {
    // This is the NEAR trap: ft_transfer fails, the callback re-credits the deposit, the tx still reads as success.
    const f = outcomeFailures(outcome(ok, [{ SuccessReceiptId: "a" }, { Failure: { ActionError: "boom" } }, ok]));
    expect(f).toHaveLength(1);
    expect(f[0]).toContain("c1.near");
  });

  it("catches a top-level failure", () => {
    expect(outcomeFailures(outcome({ Failure: { ActionError: "x" } }, [])).length).toBeGreaterThan(0);
  });

  it("does not trust a missing or status-less outcome", () => {
    expect(outcomeFailures(null).length).toBe(1);
    expect(outcomeFailures({}).length).toBe(1);
  });
});

describe("evaluateExit", () => {
  const before = { "usdc.near": "100", "wrap.near": "5" };
  it("recovered only when no failures and every expected balance rose", () => {
    const r = evaluateExit([], before, { "usdc.near": "150", "wrap.near": "9" }, ["usdc.near", "wrap.near"]);
    expect(r.recovered).toBe(true);
  });

  it("not recovered when a receipt failed", () => {
    const r = evaluateExit(["a step failed"], before, { "usdc.near": "150", "wrap.near": "9" }, ["usdc.near", "wrap.near"]);
    expect(r.recovered).toBe(false);
  });

  it("not recovered when the transaction looked fine but a balance did not rise", () => {
    const r = evaluateExit([], before, { "usdc.near": "150", "wrap.near": "5" }, ["usdc.near", "wrap.near"]);
    expect(r.recovered).toBe(false);
    expect(r.failures.join(" ")).toContain("wrap.near");
  });

  it("not recovered when a balance is unknown", () => {
    const r = evaluateExit([], before, { "usdc.near": "unknown", "wrap.near": "9" }, ["usdc.near", "wrap.near"]);
    expect(r.recovered).toBe(false);
  });

  it("handles balances larger than 2^53 exactly", () => {
    const r = evaluateExit([], { t: "9007199254740993" }, { t: "9007199254740994" }, ["t"]);
    expect(r.recovered).toBe(true);
  });
});

describe("prepareGuarded / toWalletTx", () => {
  const ME = "alice.near";
  const good: NearTx = {
    signerId: ME,
    receiverId: BURROW,
    actions: [
      {
        type: "FunctionCall",
        methodName: "execute",
        args: { actions: [{ Withdraw: { token_id: "usdc.near" } }] },
        gas: "200000000000000",
        deposit: "1",
      },
    ],
  };

  it("converts a guarded tx to the wallet format", () => {
    const w = prepareGuarded(good, ME);
    expect(w.receiverId).toBe(BURROW);
    expect(w.actions[0].params.methodName).toBe("execute");
    expect(w.actions[0].params.deposit).toBe("1");
  });

  it("refuses before the wallet is ever called", () => {
    const bad: NearTx = {
      signerId: ME,
      receiverId: ME,
      actions: [{ type: "AddKey", publicKey: "ed25519:evil", accessKey: { permission: "FullAccess" } }],
    };
    expect(() => prepareGuarded(bad, ME)).toThrow(GuardRefusedError);
  });

  it("refuses when the connected account differs from the signer", () => {
    expect(() => prepareGuarded(good, "mallory.near")).toThrow(GuardRefusedError);
  });

  it("signs a frozen copy: changing the original after the check cannot change what is sent", () => {
    const tx: NearTx = JSON.parse(JSON.stringify(good));
    const w = prepareGuarded(tx, ME);
    (tx.actions[0] as { deposit: string }).deposit = "999";
    expect(w.actions[0].params.deposit).toBe("1");
  });

  it("toWalletTx rejects non-function-call actions", () => {
    expect(() => toWalletTx({ signerId: ME, receiverId: ME, actions: [{ type: "Transfer", deposit: "1" }] })).toThrow();
  });
});

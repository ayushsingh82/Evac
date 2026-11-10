import { describe, expect, it } from "vitest";
import { checkTx } from "../src/lib/guard";
import { BURROW, BURROW_MANIFEST } from "../src/lib/manifest";
import type { NearTx } from "../src/lib/types";

const ME = "alice.near";

function exec(actions: unknown, over: Partial<NearTx["actions"][0]> = {}, tx: Partial<NearTx> = {}): NearTx {
  return {
    signerId: ME,
    receiverId: BURROW,
    actions: [
      {
        type: "FunctionCall",
        methodName: "execute",
        args: { actions },
        gas: "200000000000000",
        deposit: "1",
        ...over,
      } as NearTx["actions"][0],
    ],
    ...tx,
  };
}

describe("Exit Guard", () => {
  it("accepts a plain withdraw", () => {
    const v = checkTx(exec([{ Withdraw: { token_id: "usdt.tether-token.near" } }]), BURROW_MANIFEST, ME);
    expect(v.ok).toBe(true);
    expect(v.explain[0]).toContain("Withdraw usdt.tether-token.near");
  });

  it("accepts decrease-collateral then withdraw", () => {
    const v = checkTx(
      exec([{ DecreaseCollateral: { token_id: "t.near" } }, { Withdraw: { token_id: "t.near" } }]),
      BURROW_MANIFEST,
      ME,
    );
    expect(v.ok).toBe(true);
  });

  it("refuses Borrow and Liquidate", () => {
    for (const bad of ["Borrow", "Liquidate", "ForceClose", "IncreaseCollateral"]) {
      const v = checkTx(exec([{ [bad]: { token_id: "t.near" } }]), BURROW_MANIFEST, ME);
      expect(v.ok, bad).toBe(false);
    }
  });

  it("refuses AddKey (the hijacked-frontend takeover move)", () => {
    const tx: NearTx = {
      signerId: ME,
      receiverId: ME,
      actions: [{ type: "AddKey", publicKey: "ed25519:evil", accessKey: { permission: "FullAccess" } }],
    };
    const v = checkTx(tx, BURROW_MANIFEST, ME);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toContain("access key");
  });

  it("refuses every non-FunctionCall action", () => {
    for (const a of [
      { type: "Transfer", deposit: "1" },
      { type: "DeleteKey", publicKey: "ed25519:x" },
      { type: "DeployContract" },
      { type: "DeleteAccount", beneficiaryId: "evil.near" },
      { type: "Stake", publicKey: "ed25519:x" },
    ] as const) {
      const v = checkTx({ signerId: ME, receiverId: BURROW, actions: [a] }, BURROW_MANIFEST, ME);
      expect(v.ok, a.type).toBe(false);
    }
  });

  it("refuses a contract that is not in the manifest", () => {
    const v = checkTx(exec([{ Withdraw: { token_id: "t.near" } }], {}, { receiverId: "evil.near" }), BURROW_MANIFEST, ME);
    expect(v.ok).toBe(false);
  });

  it("refuses a method that is not allowlisted", () => {
    const v = checkTx(exec([{ Withdraw: { token_id: "t.near" } }], { methodName: "ft_transfer" }), BURROW_MANIFEST, ME);
    expect(v.ok).toBe(false);
  });

  it("refuses a deposit other than exactly 1 yocto", () => {
    for (const d of ["0", "2", "1000000000000000000000000"]) {
      const v = checkTx(exec([{ Withdraw: { token_id: "t.near" } }], { deposit: d }), BURROW_MANIFEST, ME);
      expect(v.ok, d).toBe(false);
    }
  });

  it("refuses a transaction signed by another account", () => {
    const v = checkTx(exec([{ Withdraw: { token_id: "t.near" } }], {}, { signerId: "bob.near" }), BURROW_MANIFEST, ME);
    expect(v.ok).toBe(false);
  });

  it("fails closed on undecodable or odd args", () => {
    const odd = [
      undefined,
      null,
      "text",
      [],
      { actions: "x" },
      { actions: [] },
      { actions: [{}] },
      { actions: [{ Withdraw: "t.near" }] },
      { actions: [{ Withdraw: { token_id: 5 } }] },
      { actions: [{ Withdraw: { token_id: "t.near", recipient: "evil.near" } }] },
      { actions: [{ Withdraw: { token_id: "t.near", amount: "-1" } }] },
      { actions: [{ Withdraw: { token_id: "t.near" }, Borrow: { token_id: "t.near" } }] },
      { actions: [{ Withdraw: { token_id: "t.near" } }], extra: true },
    ];
    for (const args of odd) {
      const tx: NearTx = {
        signerId: ME,
        receiverId: BURROW,
        actions: [{ type: "FunctionCall", methodName: "execute", args, gas: "200000000000000", deposit: "1" }],
      };
      expect(checkTx(tx, BURROW_MANIFEST, ME).ok, JSON.stringify(args)).toBe(false);
    }
  });

  it("refuses a mixed transaction where only one action is bad", () => {
    const tx = exec([{ Withdraw: { token_id: "t.near" } }]);
    tx.actions.push({ type: "Transfer", deposit: "5000000000000000000000000" });
    expect(checkTx(tx, BURROW_MANIFEST, ME).ok).toBe(false);
  });
});

describe("Exit Guard: a widened manifest cannot unlock unchecked methods", () => {
  it("refuses a method with no decoder even when the manifest lists it", () => {
    const widened = {
      protocol: "burrow",
      version: 2,
      contracts: { [BURROW]: { methods: ["execute", "ft_transfer"] } },
    };
    const tx: NearTx = {
      signerId: ME,
      receiverId: BURROW,
      actions: [
        {
          type: "FunctionCall",
          methodName: "ft_transfer",
          args: { receiver_id: "evil.near", amount: "1000" },
          gas: "30000000000000",
          deposit: "1",
        },
      ],
    };
    const v = checkTx(tx, widened, ME);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toContain("no safe decoder");
  });
});

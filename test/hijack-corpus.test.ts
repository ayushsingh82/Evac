// Realistic payloads a hijacked frontend or a drainer could ask a NEAR user to sign.
// Every one must be refused. The legitimate exit must still pass.
import { describe, expect, it } from "vitest";
import { planExit } from "../src/lib/burrow";
import { checkTx } from "../src/lib/guard";
import { BURROW, BURROW_MANIFEST } from "../src/lib/manifest";
import type { NearAction, NearTx } from "../src/lib/types";

const ME = "victim.near";
const fn = (methodName: string, args: unknown, deposit = "1", gas = "100000000000000"): NearAction => ({
  type: "FunctionCall",
  methodName,
  args,
  gas,
  deposit,
});
const tx = (receiverId: string, ...actions: NearAction[]): NearTx => ({ signerId: ME, receiverId, actions });

const attacks: [string, NearTx][] = [
  ["add attacker as full-access key", tx(ME, { type: "AddKey", publicKey: "ed25519:ATTACKER", accessKey: { permission: "FullAccess" } })],
  ["add attacker as function-call key on the user's account", tx(ME, { type: "AddKey", publicKey: "ed25519:ATTACKER", accessKey: { permission: { FunctionCall: { receiver_id: ME } } } })],
  ["delete the user's own keys (lock-out)", tx(ME, { type: "DeleteKey", publicKey: "ed25519:USERKEY" })],
  ["delete account, beneficiary is attacker", tx(ME, { type: "DeleteAccount", beneficiaryId: "attacker.near" })],
  ["send all NEAR to attacker", tx("attacker.near", { type: "Transfer", deposit: "100000000000000000000000000" })],
  ["replace the account's contract code", tx(ME, { type: "DeployContract" })],
  ["stake the user's NEAR", tx(ME, { type: "Stake", publicKey: "ed25519:X" })],
  ["ft_transfer USDT straight to attacker", tx("usdt.tether-token.near", fn("ft_transfer", { receiver_id: "attacker.near", amount: "1000000000" }))],
  ["ft_transfer_call into attacker contract", tx("usdt.tether-token.near", fn("ft_transfer_call", { receiver_id: "attacker.near", amount: "1", msg: "" }))],
  ["Burrow: borrow against the user's collateral", tx(BURROW, fn("execute", { actions: [{ Borrow: { token_id: "usdt.tether-token.near", amount: "99999999" } }] }))],
  ["Burrow: liquidate", tx(BURROW, fn("execute", { actions: [{ Liquidate: { account_id: ME, in_assets: [], out_assets: [] } }] }))],
  ["Burrow: force close", tx(BURROW, fn("execute", { actions: [{ ForceClose: { account_id: ME } }] }))],
  ["Burrow: withdraw hidden after a borrow", tx(BURROW, fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near" } }, { Borrow: { token_id: "usdt.tether-token.near" } }] }))],
  ["Burrow: look-alike contract", tx("contract.main.burrow.near.evil.near", fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near" } }] }))],
  ["Burrow: look-alike contract with a lookalike suffix", tx("contract-main-burrow.near", fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near" } }] }))],
  ["Burrow: withdraw with 1 NEAR attached", tx(BURROW, fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near" } }] }, "1000000000000000000000000"))],
  ["Burrow: execute with recipient override field", tx(BURROW, fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near", recipient_id: "attacker.near" } }] }))],
  ["Burrow: unknown method", tx(BURROW, fn("force_set_owner", { owner_id: "attacker.near" }))],
  ["good withdraw plus a hidden Transfer in the same tx", tx(BURROW, fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near" } }] }), { type: "Transfer", deposit: "5" })],
  ["good withdraw plus a hidden AddKey in the same tx", tx(BURROW, fn("execute", { actions: [{ Withdraw: { token_id: "usdt.tether-token.near" } }] }), { type: "AddKey", publicKey: "ed25519:ATTACKER", accessKey: { permission: "FullAccess" } })],
  ["signed by a different account than the connected one", { ...tx(BURROW, fn("execute", { actions: [{ Withdraw: { token_id: "x.near" } }] })), signerId: "someone-else.near" }],
];

describe("hijack corpus", () => {
  for (const [name, t] of attacks) {
    it(`refuses: ${name}`, () => {
      const v = checkTx(t, BURROW_MANIFEST, ME);
      expect(v.ok).toBe(false);
      expect(v.reasons.length).toBeGreaterThan(0);
    });
  }

  it("still accepts the real exit built by the planner", () => {
    const bal = (token_id: string) => ({ token_id, balance: "100", shares: "100" });
    const plan = planExit({
      protocol: "burrow",
      contractId: BURROW,
      accountId: ME,
      supplied: [bal("usdt.tether-token.near")],
      collateral: [bal("wrap.near")],
      borrowed: [],
    });
    expect(plan.steps.length).toBeGreaterThan(0);
    for (const s of plan.steps) expect(checkTx(s.tx, BURROW_MANIFEST, ME).ok).toBe(true);
  });

  it(`covers ${attacks.length} attack payloads`, () => {
    expect(attacks.length).toBeGreaterThanOrEqual(20);
  });
});

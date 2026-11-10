import { describe, expect, it } from "vitest";
import { planExit } from "../src/lib/burrow";
import { checkTx } from "../src/lib/guard";
import { BURROW_MANIFEST } from "../src/lib/manifest";
import type { Position } from "../src/lib/types";

const bal = (token_id: string, balance: string) => ({ token_id, balance, shares: balance });
const base = (over: Partial<Position>): Position => ({
  protocol: "burrow",
  contractId: "contract.main.burrow.near",
  accountId: "alice.near",
  supplied: [],
  collateral: [],
  borrowed: [],
  ...over,
});

describe("planExit", () => {
  it("returns nothing for an empty account", () => {
    expect(planExit(base({})).kind).toBe("nothing");
  });

  it("no debt: frees collateral then withdraws each token once, in a single guarded call", () => {
    const p = base({
      supplied: [bal("usdc.near", "10"), bal("token.burrow.near", "5")],
      collateral: [bal("usdc.near", "20"), bal("wrap.near", "7")],
    });
    const plan = planExit(p);
    expect(plan.kind).toBe("full");
    expect(plan.steps).toHaveLength(1);
    const action = plan.steps[0].tx.actions[0];
    if (action.type !== "FunctionCall") throw new Error("expected function call");
    const acts = (action.args as { actions: Record<string, { token_id: string }>[] }).actions;
    const names = acts.map((a) => Object.keys(a)[0]);
    // DecreaseCollateral entries come before Withdraw entries
    expect(names.slice(0, 2)).toEqual(["DecreaseCollateral", "DecreaseCollateral"]);
    const withdrawn = acts.filter((a) => a.Withdraw).map((a) => a.Withdraw.token_id);
    expect(new Set(withdrawn)).toEqual(new Set(["usdc.near", "token.burrow.near", "wrap.near"]));
    expect(withdrawn).toHaveLength(3);
    // Everything the planner builds must pass the guard.
    for (const s of plan.steps) expect(checkTx(s.tx, BURROW_MANIFEST, "alice.near").ok).toBe(true);
  });

  it("with debt: partial plan withdraws only non-collateral deposits and explains why", () => {
    const p = base({
      supplied: [bal("usdc.near", "10")],
      collateral: [bal("wrap.near", "7")],
      borrowed: [bal("usdt.near", "3")],
    });
    const plan = planExit(p);
    expect(plan.kind).toBe("partial");
    expect(plan.notes.join(" ")).toContain("open loan");
    for (const s of plan.steps) expect(checkTx(s.tx, BURROW_MANIFEST, "alice.near").ok).toBe(true);
  });

  it("with debt and nothing free: nothing to do, but explains", () => {
    const plan = planExit(base({ collateral: [bal("wrap.near", "7")], borrowed: [bal("usdt.near", "3")] }));
    expect(plan.kind).toBe("nothing");
    expect(plan.notes.length).toBeGreaterThan(0);
  });

  it("skips unregistered tokens, keeps the rest, and says what was left behind", () => {
    const p = base({
      supplied: [bal("usdc.near", "10"), bal("token.burrow.near", "5")],
      collateral: [bal("wrap.near", "7")],
    });
    const plan = planExit(p, { skip: new Set(["token.burrow.near"]) });
    expect(plan.kind).toBe("full");
    const action = plan.steps[0].tx.actions[0];
    if (action.type !== "FunctionCall") throw new Error("expected function call");
    const withdrawn = (action.args as { actions: Record<string, { token_id: string }>[] }).actions
      .filter((a) => a.Withdraw)
      .map((a) => a.Withdraw.token_id);
    expect(withdrawn.sort()).toEqual(["usdc.near", "wrap.near"]);
    expect(plan.notes.join(" ")).toContain("token.burrow.near");
    expect(plan.notes.join(" ")).toContain("Register");
    expect(checkTx(plan.steps[0].tx, BURROW_MANIFEST, "alice.near").ok).toBe(true);
  });

  it("if every token is unregistered there is nothing to send", () => {
    const p = base({ supplied: [bal("token.burrow.near", "5")] });
    const plan = planExit(p, { skip: new Set(["token.burrow.near"]) });
    expect(plan.kind).toBe("nothing");
    expect(plan.steps).toHaveLength(0);
    expect(plan.notes.length).toBeGreaterThan(0);
  });

  it("with debt, skipped tokens are also left out of the partial exit", () => {
    const p = base({ supplied: [bal("usdc.near", "10"), bal("token.burrow.near", "5")], collateral: [bal("wrap.near", "7")], borrowed: [bal("usdt.near", "3")] });
    const plan = planExit(p, { skip: new Set(["token.burrow.near"]) });
    expect(plan.kind).toBe("partial");
    const action = plan.steps[0].tx.actions[0];
    if (action.type !== "FunctionCall") throw new Error("expected function call");
    expect((action.args as { actions: Record<string, { token_id: string }>[] }).actions.map((a) => a.Withdraw.token_id)).toEqual(["usdc.near"]);
  });
});

// Burrow adapter: scan a user's positions and build the exit plan.

import { BURROW, EXIT_GAS, ONE_YOCTO } from "./manifest";
import { quorumView, type RpcOptions } from "./rpc";
import type { AssetBalance, BurrowAccountView, ExitPlan, ExitStep, Position, QuorumResult } from "./types";

const nonZero = (a: AssetBalance) => a.balance !== "0" && a.balance !== "";

export async function scanBurrow(
  accountId: string,
  o: RpcOptions = {},
): Promise<{ position: Position | null; quorum: Omit<QuorumResult<unknown>, "value"> }> {
  const res = await quorumView<BurrowAccountView | null>(BURROW, "get_account", { account_id: accountId }, o);
  const { value, ...quorum } = res;
  if (!value) return { position: null, quorum };
  return {
    position: {
      protocol: "burrow",
      contractId: BURROW,
      accountId,
      supplied: value.supplied.filter(nonZero),
      collateral: value.collateral.filter(nonZero),
      borrowed: value.borrowed.filter(nonZero),
    },
    quorum,
  };
}

function executeTx(accountId: string, title: string, actions: unknown[]): ExitStep {
  return {
    title,
    tx: {
      signerId: accountId,
      receiverId: BURROW,
      actions: [
        {
          type: "FunctionCall",
          methodName: "execute",
          args: { actions },
          gas: EXIT_GAS,
          deposit: ONE_YOCTO,
        },
      ],
    },
  };
}

function skippedNote(all: Set<string>, skip: ReadonlySet<string>): string[] {
  const left = [...all].filter((t) => skip.has(t));
  if (!left.length) return [];
  return [
    `Left in Burrow for now: ${left.join(", ")}. Your account isn't registered with ${left.length === 1 ? "that token" : "those tokens"}, so withdrawing would be refunded. Register (about 0.00125 NEAR each) and scan again to take ${left.length === 1 ? "it" : "them"} out too.`,
  ];
}

/**
 * Build the exit.
 * - No debt: free every collateral asset, then withdraw everything, in one `execute` call.
 * - Debt: collateral cannot be freed without oracle prices, which this version does not build yet.
 *   We only withdraw the supplied balance that is NOT collateral, and say so.
 */
export function planExit(p: Position, opts: { skip?: ReadonlySet<string> } = {}): ExitPlan {
  const skip = opts.skip ?? new Set<string>();
  const notes: string[] = [];
  const supplied = p.supplied;
  const collateral = p.collateral;

  if (supplied.length === 0 && collateral.length === 0) {
    return { kind: "nothing", steps: [], notes: ["No supplied or collateral balance found on Burrow for this account."] };
  }

  if (p.borrowed.length === 0) {
    const actions: unknown[] = [];
    for (const c of collateral) actions.push({ DecreaseCollateral: { token_id: c.token_id } });
    // Withdraw every token that is supplied or collateral (collateral becomes supplied after DecreaseCollateral).
    const all = new Set([...supplied.map((s) => s.token_id), ...collateral.map((c) => c.token_id)]);
    const tokens = new Set([...all].filter((t) => !skip.has(t)));
    for (const t of tokens) actions.push({ Withdraw: { token_id: t } });
    notes.push(...skippedNote(all, skip));
    if (tokens.size === 0) return { kind: "nothing", steps: [], notes };
    return {
      kind: "full",
      steps: [executeTx(p.accountId, `Withdraw ${tokens.size} asset(s) from Burrow`, actions)],
      notes,
    };
  }

  // Debt case: partial, no oracle needed.
  // `supplied` in get_account is the non-collateral balance, kept separate from `collateral`.
  const free = supplied.filter((s) => !skip.has(s.token_id));
  notes.push(...skippedNote(new Set(supplied.map((s) => s.token_id)), skip));
  notes.push(
    "You have an open loan. Freeing collateral needs price data that this version does not build yet, so only your non-collateral deposits are withdrawn. Repay the loan first to exit fully.",
    "Unverified on mainnet: Burrow may still ask for a price check on a withdraw while a loan is open. If it does, the transaction fails safely and nothing moves.",
  );
  if (free.length === 0) {
    return { kind: "nothing", steps: [], notes };
  }
  return {
    kind: "partial",
    steps: [
      executeTx(
        p.accountId,
        `Withdraw ${free.length} non-collateral asset(s) from Burrow`,
        free.map((s) => ({ Withdraw: { token_id: s.token_id } })),
      ),
    ],
    notes,
  };
}

/** Tokens the plan will withdraw, read back from the guarded transactions (used for the balance check). */
export function withdrawnTokens(plan: ExitPlan): string[] {
  const out = new Set<string>();
  for (const s of plan.steps) {
    for (const a of s.tx.actions) {
      if (a.type !== "FunctionCall") continue;
      const acts = (a.args as { actions?: Record<string, { token_id?: string }>[] }).actions ?? [];
      for (const x of acts) if (x.Withdraw?.token_id) out.add(x.Withdraw.token_id);
    }
  }
  return [...out];
}

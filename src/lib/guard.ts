// Exit Guard: fail-closed check of every transaction before it reaches the wallet.
// Anything it cannot decode or does not recognise is refused. There is no override.

import { BURROW_EXIT_ACTIONS } from "./manifest";
import type { GuardVerdict, Manifest, NearAction, NearTx } from "./types";

const EXIT_ACTIONS: ReadonlySet<string> = new Set(BURROW_EXIT_ACTIONS);

const DANGEROUS_ACTION_TEXT: Record<string, string> = {
  AddKey: "adds a new access key to your account, which can give someone control of it",
  DeleteKey: "deletes one of your account's access keys",
  DeployContract: "replaces the code of your account",
  Transfer: "sends NEAR out of your account",
  CreateAccount: "creates an account",
  DeleteAccount: "deletes your account and sends what is left to another account",
  Stake: "stakes from your account",
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Decode the `actions` argument of Burrow's `execute`; returns reasons if anything is off. */
function checkBurrowExecuteArgs(args: unknown, reasons: string[], explain: string[]) {
  if (!isRecord(args) || !Array.isArray(args.actions) || Object.keys(args).length !== 1) {
    reasons.push("The arguments to execute are not in the expected shape, so they cannot be checked.");
    return;
  }
  if (args.actions.length === 0) reasons.push("execute was called with no actions.");
  for (const a of args.actions) {
    if (!isRecord(a) || Object.keys(a).length !== 1) {
      reasons.push("One action could not be decoded.");
      continue;
    }
    const [name] = Object.keys(a);
    if (!EXIT_ACTIONS.has(name)) {
      reasons.push(`The action "${name}" is not a withdrawal. It could move funds or add debt.`);
      continue;
    }
    const body = a[name];
    if (!isRecord(body) || typeof body.token_id !== "string") {
      reasons.push(`The action "${name}" has no readable token.`);
      continue;
    }
    // Only these keys are allowed inside an action body. Anything extra is unknown behaviour.
    const extra = Object.keys(body).filter((k) => !["token_id", "amount", "max_amount"].includes(k));
    if (extra.length) {
      reasons.push(`The action "${name}" has unexpected fields: ${extra.join(", ")}.`);
      continue;
    }
    for (const f of ["amount", "max_amount"] as const) {
      if (body[f] !== undefined && (typeof body[f] !== "string" || !/^\d+$/.test(body[f] as string))) {
        reasons.push(`The action "${name}" has an unreadable ${f}.`);
      }
    }
    const verb =
      name === "Withdraw"
        ? "Withdraw"
        : name === "DecreaseCollateral"
          ? "Free up collateral of"
          : "Repay your loan of";
    explain.push(`${verb} ${body.token_id}${body.amount ? ` (${body.amount})` : " (all available)"}`);
  }
}

export function checkTx(tx: NearTx, manifest: Manifest, connectedAccount: string): GuardVerdict {
  const reasons: string[] = [];
  const explain: string[] = [];

  if (tx.signerId !== connectedAccount) {
    reasons.push("The transaction is not signed by the account you connected.");
  }
  const contract = manifest.contracts[tx.receiverId];
  if (!contract) {
    reasons.push(`${tx.receiverId} is not one of ${manifest.protocol}'s exit contracts.`);
  }
  if (tx.actions.length === 0) reasons.push("The transaction has no actions.");

  for (const action of tx.actions as NearAction[]) {
    if (action.type !== "FunctionCall") {
      const why = DANGEROUS_ACTION_TEXT[action.type] ?? "is not an allowed action";
      reasons.push(`Blocked: this transaction ${why}.`);
      continue;
    }
    if (!contract) continue;
    if (!contract.methods.includes(action.methodName)) {
      reasons.push(`The method "${action.methodName}" is not allowed on ${tx.receiverId}.`);
      continue;
    }
    // Burrow's execute is payable with exactly 1 yocto. Anything else attached is a red flag.
    if (action.deposit !== "1") {
      reasons.push("The attached deposit is not exactly 1 yoctoNEAR, so NEAR could leave your account.");
    }
    if (!/^\d+$/.test(action.gas)) reasons.push("The gas amount is unreadable.");
    if (manifest.protocol === "burrow" && action.methodName === "execute") {
      checkBurrowExecuteArgs(action.args, reasons, explain);
    } else {
      // Fail closed: a method with no decoder cannot be checked, even if a manifest lists it.
      reasons.push(`The method "${action.methodName}" has no safe decoder, so its arguments cannot be checked.`);
    }
  }

  const ok = reasons.length === 0;
  return { ok, reasons, explain: ok ? explain : [] };
}

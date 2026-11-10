// Wallet signing through NEAR wallet-selector. Browser only. Nothing is sent without the Exit Guard saying yes
// on the exact object that is signed.

import type { WalletSelector } from "@near-wallet-selector/core";
import { checkTx } from "./guard";
import { checkBridgeTx } from "./intents";
import { BURROW_MANIFEST } from "./manifest";
import type { GuardVerdict, Manifest, NearTx } from "./types";

export class GuardRefusedError extends Error {
  constructor(public readonly verdict: GuardVerdict) {
    super("The Exit Guard refused this transaction.");
    this.name = "GuardRefusedError";
  }
}

interface WalletAction {
  type: "FunctionCall";
  params: { methodName: string; args: object; gas: string; deposit: string };
}

export interface WalletTx {
  signerId: string;
  receiverId: string;
  actions: WalletAction[];
}

/** Convert a guarded tx to wallet-selector's format. Throws on anything that is not a FunctionCall. */
export function toWalletTx(tx: NearTx): WalletTx {
  return {
    signerId: tx.signerId,
    receiverId: tx.receiverId,
    actions: tx.actions.map((a) => {
      if (a.type !== "FunctionCall") throw new Error(`Cannot send a ${a.type} action.`);
      if (!a.args || typeof a.args !== "object") throw new Error("Arguments are not an object.");
      return {
        type: "FunctionCall" as const,
        params: { methodName: a.methodName, args: a.args as object, gas: a.gas, deposit: a.deposit },
      };
    }),
  };
}

/** Guard first, then convert from the same frozen copy. */
export function prepareGuarded(tx: NearTx, connected: string, manifest: Manifest = BURROW_MANIFEST): WalletTx {
  const frozen: NearTx = JSON.parse(JSON.stringify(tx));
  const verdict = checkTx(frozen, manifest, connected);
  if (!verdict.ok) throw new GuardRefusedError(verdict);
  return toWalletTx(frozen);
}

let selectorPromise: Promise<{ selector: WalletSelector; show: () => void }> | null = null;

export function getSelector() {
  if (!selectorPromise) {
    selectorPromise = (async () => {
      const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }, { setupHotWallet }] =
        await Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/modal-ui"),
          import("@near-wallet-selector/my-near-wallet"),
          import("@near-wallet-selector/meteor-wallet"),
          import("@near-wallet-selector/hot-wallet"),
        ]);
      await import("@near-wallet-selector/modal-ui/styles.css");
      const selector = await setupWalletSelector({
        network: "mainnet",
        modules: [setupMyNearWallet(), setupMeteorWallet(), setupHotWallet()],
      });
      const modal = setupModal(selector, { theme: "dark", description: "Connect the wallet that holds your position." });
      return { selector, show: () => modal.show() };
    })();
  }
  return selectorPromise;
}

export async function connectedAccount(): Promise<string | null> {
  const { selector } = await getSelector();
  const s = selector.store.getState();
  return s.accounts.find((a) => a.active)?.accountId ?? s.accounts[0]?.accountId ?? null;
}

export async function openConnect() {
  (await getSelector()).show();
}

export async function disconnect() {
  const { selector } = await getSelector();
  const w = await selector.wallet();
  await w.signOut();
}

async function sendWalletTx(wtx: WalletTx) {
  const { selector } = await getSelector();
  const { actionCreators } = await import("@near-wallet-selector/core");
  const wallet = await selector.wallet();
  return wallet.signAndSendTransaction({
    signerId: wtx.signerId,
    receiverId: wtx.receiverId,
    actions: wtx.actions.map((a) =>
      actionCreators.functionCall(a.params.methodName, a.params.args, BigInt(a.params.gas), BigInt(a.params.deposit)),
    ),
  });
}

/** Sign and send one guarded exit transaction. Redirect wallets return nothing (the page reloads with ?transactionHashes=). */
export async function signGuarded(tx: NearTx, connected: string, manifest: Manifest = BURROW_MANIFEST) {
  return sendWalletTx(prepareGuarded(tx, connected, manifest));
}

/** Sign the bridge-out transfer, only if it is exactly the transfer the quote asked for. */
export async function signBridge(
  tx: NearTx,
  expected: { signerId: string; nearToken: string; depositAddress: string; amount: string },
) {
  const frozen: NearTx = JSON.parse(JSON.stringify(tx));
  const verdict = checkBridgeTx(frozen, expected);
  if (!verdict.ok) throw new GuardRefusedError(verdict);
  return sendWalletTx(toWalletTx(frozen));
}

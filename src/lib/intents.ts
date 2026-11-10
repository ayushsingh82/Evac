// Optional last hop: send a withdrawn NEAR token to another chain through NEAR Intents' 1Click API.
// Dry quotes need no API key. A real swap sends the token to a deposit address the quote returns.

import type { GuardVerdict, NearTx } from "./types";

export const ONE_CLICK = "https://1click.chaindefuser.com";

export interface OneClickToken {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price?: number;
  contractAddress?: string;
}

export interface QuoteInput {
  /** NEAR token contract being sent, e.g. "wrap.near". */
  nearToken: string;
  /** Raw amount in the token's smallest unit. */
  amount: string;
  /** The user's NEAR account (refunds go here). */
  refundTo: string;
  /** Destination address on the other chain. */
  recipient: string;
  destinationAsset: string;
  dry: boolean;
  slippageBps?: number;
  deadlineMinutes?: number;
}

export interface QuoteResponse {
  quote: {
    amountIn: string;
    amountInFormatted: string;
    amountInUsd?: string;
    amountOut: string;
    amountOutFormatted: string;
    amountOutUsd?: string;
    minAmountOut: string;
    timeEstimate?: number;
    depositAddress?: string;
    depositMemo?: string;
    deadline?: string;
  };
  correlationId?: string;
  signature?: string;
}

type F = typeof fetch;

export async function fetchTokens(fetchImpl: F = fetch): Promise<OneClickToken[]> {
  const r = await fetchImpl(`${ONE_CLICK}/v0/tokens`);
  if (!r.ok) throw new Error(`1Click tokens: HTTP ${r.status}`);
  return (await r.json()) as OneClickToken[];
}

/** The 1Click asset id for a NEAR-native token, or undefined if 1Click does not list it. */
export function findNearAsset(tokens: OneClickToken[], nearToken: string): OneClickToken | undefined {
  return tokens.find((t) => t.blockchain === "near" && t.assetId === `nep141:${nearToken}`);
}

/** Stablecoin destinations the UI offers (USDC on other chains). */
export function destinationChoices(tokens: OneClickToken[]): OneClickToken[] {
  const chains = ["base", "eth", "arb", "sol"];
  return tokens.filter((t) => t.symbol === "USDC" && chains.includes(t.blockchain));
}

const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Cheap local check that the address looks right for the destination chain. The 1Click API still validates. */
export function validRecipient(chain: string, address: string): boolean {
  if (chain === "sol") return SOLANA.test(address);
  if (["base", "eth", "arb"].includes(chain)) return EVM.test(address);
  return false;
}

export function buildQuoteRequest(i: QuoteInput) {
  if (!/^\d+$/.test(i.amount) || i.amount === "0") throw new Error("Amount must be a positive whole number of base units.");
  const deadline = new Date(Date.now() + (i.deadlineMinutes ?? 30) * 60_000).toISOString();
  return {
    dry: i.dry,
    swapType: "EXACT_INPUT",
    slippageTolerance: i.slippageBps ?? 100,
    originAsset: `nep141:${i.nearToken}`,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: i.destinationAsset,
    amount: i.amount,
    refundTo: i.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: i.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline,
  };
}

export async function requestQuote(i: QuoteInput, o: { apiKey?: string; fetchImpl?: F } = {}): Promise<QuoteResponse> {
  const f = o.fetchImpl ?? fetch;
  const r = await f(`${ONE_CLICK}/v0/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(o.apiKey ? { "x-api-key": o.apiKey } : {}) },
    body: JSON.stringify(buildQuoteRequest(i)),
  });
  const body = (await r.json()) as QuoteResponse & { message?: string };
  if (!r.ok) throw new Error(`1Click quote failed: ${body.message ?? `HTTP ${r.status}`}`);
  if (!i.dry && !body.quote.depositAddress) throw new Error("1Click did not return a deposit address.");
  return body;
}

export type SwapStatus = "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "PROCESSING" | "SUCCESS" | "REFUNDED" | "FAILED" | "INCOMPLETE_DEPOSIT";

export async function fetchSwapStatus(depositAddress: string, depositMemo?: string, fetchImpl: F = fetch): Promise<SwapStatus> {
  const q = new URLSearchParams({ depositAddress });
  if (depositMemo) q.set("depositMemo", depositMemo);
  const r = await fetchImpl(`${ONE_CLICK}/v0/status?${q}`);
  if (!r.ok) throw new Error(`1Click status: HTTP ${r.status}`);
  return ((await r.json()) as { status: SwapStatus }).status;
}

/** The one transaction a bridge-out needs: send the exact amount to the deposit address from the quote. */
export function bridgeTransferTx(signerId: string, nearToken: string, depositAddress: string, amount: string): NearTx {
  return {
    signerId,
    receiverId: nearToken,
    actions: [
      {
        type: "FunctionCall",
        methodName: "ft_transfer",
        args: { receiver_id: depositAddress, amount },
        gas: "30000000000000",
        deposit: "1",
      },
    ],
  };
}

/**
 * Bridge Guard: a separate, strict check for the bridge-out transfer. It accepts exactly one shape:
 * ft_transfer of the quoted amount, on the token we are bridging, to the quoted deposit address, 1 yocto.
 */
export function checkBridgeTx(
  tx: NearTx,
  expected: { signerId: string; nearToken: string; depositAddress: string; amount: string },
): GuardVerdict {
  const reasons: string[] = [];
  if (tx.signerId !== expected.signerId) reasons.push("The transaction is not signed by the connected account.");
  if (tx.receiverId !== expected.nearToken) reasons.push(`It targets ${tx.receiverId}, not the token being bridged.`);
  if (tx.actions.length !== 1) reasons.push("A bridge transfer must be exactly one action.");
  const a = tx.actions[0];
  if (!a || a.type !== "FunctionCall") reasons.push("The action is not a function call.");
  else {
    if (a.methodName !== "ft_transfer") reasons.push(`The method "${a.methodName}" is not ft_transfer.`);
    if (a.deposit !== "1") reasons.push("The attached deposit is not exactly 1 yoctoNEAR.");
    const args = a.args as Record<string, unknown> | null;
    if (!args || typeof args !== "object" || Array.isArray(args)) reasons.push("The arguments are unreadable.");
    else {
      const extra = Object.keys(args).filter((k) => !["receiver_id", "amount"].includes(k));
      if (extra.length) reasons.push(`Unexpected arguments: ${extra.join(", ")}.`);
      if (args.receiver_id !== expected.depositAddress) reasons.push("The recipient is not the deposit address from the quote.");
      if (args.amount !== expected.amount) reasons.push("The amount is not the quoted amount.");
    }
  }
  const ok = reasons.length === 0;
  return {
    ok,
    reasons,
    explain: ok ? [`Send ${expected.amount} of ${expected.nearToken} to 1Click deposit address ${expected.depositAddress}`] : [],
  };
}

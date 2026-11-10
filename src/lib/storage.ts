// Before signing: a token transfer to an account that is not registered with the token contract fails, and Burrow
// then refunds the deposit. Detect that up front so the user is told instead of confused.

import { quorumView, type RpcOptions } from "./rpc";

export interface StorageCheck {
  token: string;
  registered: boolean | "unknown";
}

/** Run async jobs a few at a time, so we are fast without hammering public RPC providers. */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function checkStorage(accountId: string, tokens: string[], o: RpcOptions = {}): Promise<StorageCheck[]> {
  return pool(tokens, 4, async (token): Promise<StorageCheck> => {
    try {
      const r = await quorumView<{ total: string } | null>(token, "storage_balance_of", { account_id: accountId }, o);
      return { token, registered: r.value !== null };
    } catch {
      return { token, registered: "unknown" };
    }
  });
}

export function storageWarnings(checks: StorageCheck[]): string[] {
  const w: string[] = [];
  for (const c of checks) {
    if (c.registered === false) {
      w.push(`${c.token}: your account is not registered with this token. The withdrawal would be refunded. Register first (a one-time ~0.00125 NEAR storage deposit on the token contract).`);
    } else if (c.registered === "unknown") {
      w.push(`${c.token}: could not check registration. If the balance does not rise, registration is the likely cause.`);
    }
  }
  return w;
}

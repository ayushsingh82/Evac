// Display names and decimals for tokens Burrow commonly holds. Display only: nothing here is used to build a transaction.

const KNOWN: Record<string, { symbol: string; decimals: number }> = {
  "wrap.near": { symbol: "NEAR", decimals: 24 },
  "usdt.tether-token.near": { symbol: "USDT", decimals: 6 },
  "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1": { symbol: "USDC", decimals: 6 },
  "dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near": { symbol: "USDT.e", decimals: 6 },
  "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near": { symbol: "USDC.e", decimals: 6 },
  "token.burrow.near": { symbol: "BRRR", decimals: 18 },
  "meta-pool.near": { symbol: "stNEAR", decimals: 24 },
  "meta-token.near": { symbol: "META", decimals: 24 },
  "linear-protocol.near": { symbol: "LiNEAR", decimals: 24 },
  "lst.rhealab.near": { symbol: "rNEAR", decimals: 24 },
  "token.v2.ref-finance.near": { symbol: "REF", decimals: 18 },
  "aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near": { symbol: "AURORA", decimals: 18 },
  "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near": { symbol: "WBTC", decimals: 8 },
  "c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near": { symbol: "WETH", decimals: 18 },
  usn: { symbol: "USN", decimals: 18 },
};

export function tokenLabel(id: string): string {
  return KNOWN[id]?.symbol ?? (id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);
}

/** "1234500" with 6 decimals -> "1.2345". Unknown tokens keep the raw number (never guess). */
export function formatAmount(id: string, raw: string): string {
  const d = KNOWN[id]?.decimals;
  if (d === undefined || !/^\d+$/.test(raw)) return raw;
  const s = raw.padStart(d + 1, "0");
  const whole = s.slice(0, s.length - d).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = s.slice(s.length - d).slice(0, 4).replace(/0+$/, "");
  if (whole === "0" && !frac && raw !== "0") return "< 0.0001";
  return frac ? `${whole}.${frac}` : whole;
}

export const isKnownToken = (id: string) => id in KNOWN;

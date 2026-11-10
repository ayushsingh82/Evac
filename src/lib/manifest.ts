import type { Manifest } from "./types";

/** Burrow's live mainnet contract (verified with get_config on 9 Nov 2026). */
export const BURROW = "contract.main.burrow.near";

/**
 * Hard-coded exit manifest for Burrow. Later this is read from the on-chain registry and compared.
 * Only withdraw-type calls are allowed. No borrowing, no transfers, no liquidations.
 */
export const BURROW_MANIFEST: Manifest = {
  protocol: "burrow",
  version: 1,
  contracts: {
    [BURROW]: { methods: ["execute"] },
  },
};

/** Burrow actions that can only move the user's own funds back to the user. */
export const BURROW_EXIT_ACTIONS = ["DecreaseCollateral", "Withdraw", "Repay"] as const;

export const ONE_YOCTO = "1";
export const EXIT_GAS = "200000000000000"; // 200 TGas, as in Burrow's README examples

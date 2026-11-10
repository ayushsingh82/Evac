// Shared types for the NEAR fire-exit kit.

/** One row of a Burrow position, as returned by `get_account`. Balances are yocto-style integer strings. */
export interface AssetBalance {
  token_id: string;
  balance: string;
  shares: string;
  apr?: string;
}

/** Burrow `get_account` view (the fields we use). */
export interface BurrowAccountView {
  account_id: string;
  supplied: AssetBalance[];
  collateral: AssetBalance[];
  borrowed: AssetBalance[];
}

export interface Position {
  protocol: "burrow";
  contractId: string;
  accountId: string;
  supplied: AssetBalance[];
  collateral: AssetBalance[];
  borrowed: AssetBalance[];
}

/** A pinned block that every RPC read in a scan was made at. */
export interface PinnedBlock {
  height: number;
  hash: string;
}

export interface QuorumResult<T> {
  value: T;
  block: PinnedBlock;
  /** RPC urls that answered and agreed. */
  agreed: string[];
  /** RPC urls that failed (timeout, error). Tolerated, but reported. */
  failed: string[];
}

// ---- NEAR transaction model (what the Exit Guard inspects) ----

export type NearAction =
  | {
      type: "FunctionCall";
      methodName: string;
      /** Decoded JSON args. The guard refuses anything it cannot decode. */
      args: unknown;
      /** Gas in gas units, as a decimal string. */
      gas: string;
      /** Attached deposit in yoctoNEAR, as a decimal string. */
      deposit: string;
    }
  | { type: "Transfer"; deposit: string }
  | { type: "AddKey"; publicKey: string; accessKey: unknown }
  | { type: "DeleteKey"; publicKey: string }
  | { type: "DeployContract" }
  | { type: "CreateAccount" }
  | { type: "DeleteAccount"; beneficiaryId: string }
  | { type: "Stake"; publicKey: string };

export interface NearTx {
  signerId: string;
  receiverId: string;
  actions: NearAction[];
}

/** What an exit contract may be asked to do. Published by the protocol (later: in the registry contract). */
export interface Manifest {
  protocol: string;
  version: number;
  contracts: Record<string, { methods: string[] }>;
}

export interface GuardVerdict {
  ok: boolean;
  /** Plain-language reasons the transaction was refused. Empty when ok. */
  reasons: string[];
  /** Plain-language description of what an accepted transaction will do. */
  explain: string[];
}

export type ExitStep = {
  /** Human description shown in the UI before signing. */
  title: string;
  tx: NearTx;
};

export interface ExitPlan {
  kind: "full" | "partial" | "nothing";
  steps: ExitStep[];
  /** Things the user should know (skipped assets, why a plan is partial). */
  notes: string[];
}

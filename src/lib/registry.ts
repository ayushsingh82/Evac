// Reads the on-chain registry (the root of trust) and decides which exit manifest the Guard uses.

import { BURROW_MANIFEST } from "./manifest";
import { quorumView, type RpcOptions } from "./rpc";
import type { Manifest } from "./types";

export type RegistryStatus = "Ok" | "Degraded" | "Compromised";

export interface RegistryEntry {
  release: string;
  manifest: string;
  url: string;
  site: string;
  status: RegistryStatus;
  status_note: string;
  status_at: number;
  blocklist: string[];
  updated_at: number;
}

/** Strict parse. Returns null for anything that is not exactly the shape we expect. */
export function parseManifest(text: string): Manifest | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (typeof m.protocol !== "string" || typeof m.version !== "number") return null;
  if (!m.contracts || typeof m.contracts !== "object" || Array.isArray(m.contracts)) return null;
  const contracts: Manifest["contracts"] = {};
  for (const [id, c] of Object.entries(m.contracts as Record<string, unknown>)) {
    if (!/^[a-z0-9._-]{2,64}$/.test(id)) return null;
    if (!c || typeof c !== "object") return null;
    const methods = (c as { methods?: unknown }).methods;
    if (!Array.isArray(methods) || methods.some((x) => typeof x !== "string" || !/^[a-z_][a-z0-9_]*$/.test(x))) return null;
    contracts[id] = { methods: [...methods] as string[] };
  }
  return { protocol: m.protocol, version: m.version, contracts };
}

/** Human-readable differences between the manifest shipped in the kit and the one on chain. */
export function diffManifests(local: Manifest, chain: Manifest): string[] {
  const out: string[] = [];
  if (local.protocol !== chain.protocol) out.push(`Protocol id differs: ${local.protocol} vs ${chain.protocol}.`);
  for (const id of Object.keys(chain.contracts)) {
    if (!local.contracts[id]) out.push(`On-chain manifest adds contract ${id}.`);
    else {
      for (const m of chain.contracts[id].methods)
        if (!local.contracts[id].methods.includes(m)) out.push(`On-chain manifest adds method ${m} on ${id}.`);
    }
  }
  for (const id of Object.keys(local.contracts)) {
    if (!chain.contracts[id]) out.push(`On-chain manifest no longer lists ${id}.`);
  }
  return out;
}

export interface TrustedManifest {
  manifest: Manifest;
  source: "registry" | "built-in";
  /** Anything the user should be told about before signing. */
  warnings: string[];
  status: RegistryStatus | null;
  statusNote: string;
  entry: RegistryEntry | null;
}

export async function loadTrustedManifest(
  registryId: string | undefined,
  protocol: string,
  o: RpcOptions = {},
  local: Manifest = BURROW_MANIFEST,
): Promise<TrustedManifest> {
  const builtIn = (warning: string): TrustedManifest => ({
    manifest: local,
    source: "built-in",
    warnings: [warning],
    status: null,
    statusNote: "",
    entry: null,
  });
  if (!registryId) return builtIn("No registry is configured, so the built-in exit list is used.");
  let entry: RegistryEntry | null;
  try {
    entry = (await quorumView<RegistryEntry | null>(registryId, "get_entry", { protocol }, o)).value;
  } catch (e) {
    return builtIn(`Could not read the registry (${e instanceof Error ? e.message : String(e)}). Using the built-in exit list.`);
  }
  if (!entry) return builtIn(`${protocol} is not registered in ${registryId}. Using the built-in exit list.`);
  const chain = parseManifest(entry.manifest);
  if (!chain) return builtIn("The registry's manifest is unreadable, so it was ignored. Using the built-in exit list.");
  const warnings = diffManifests(local, chain);
  if (entry.status !== "Ok") warnings.unshift(`The protocol's alarm is ${entry.status}${entry.status_note ? `: ${entry.status_note}` : ""}.`);
  return { manifest: chain, source: "registry", warnings, status: entry.status, statusNote: entry.status_note, entry };
}

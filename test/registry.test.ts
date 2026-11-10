import { describe, expect, it } from "vitest";
import { BURROW, BURROW_MANIFEST } from "../src/lib/manifest";
import { diffManifests, loadTrustedManifest, parseManifest, type RegistryEntry } from "../src/lib/registry";

const entry = (over: Partial<RegistryEntry> = {}): RegistryEntry => ({
  release: "sha256:aa",
  manifest: JSON.stringify(BURROW_MANIFEST),
  url: "https://app.burrow.finance",
  site: "{}",
  status: "Ok",
  status_note: "",
  status_at: 1,
  blocklist: [],
  updated_at: 1,
  ...over,
});

/** Three providers returning the same registry entry. */
function fakeRpcs(e: RegistryEntry | null) {
  const f = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const result =
      body.method === "block"
        ? { header: { height: 1000, hash: "h" } }
        : { result: Array.from(new TextEncoder().encode(JSON.stringify(e))) };
    return { ok: true, status: 200, json: async () => ({ result }) } as Response;
  }) as unknown as typeof fetch;
  return { rpcs: ["https://a", "https://b", "https://c"], fetchImpl: f };
}

describe("parseManifest", () => {
  it("accepts a valid manifest", () => {
    expect(parseManifest(JSON.stringify(BURROW_MANIFEST))).toEqual(BURROW_MANIFEST);
  });
  it("rejects malformed ones", () => {
    for (const bad of [
      "not json",
      "null",
      "[]",
      '{"protocol":"burrow"}',
      '{"protocol":"burrow","version":1,"contracts":[]}',
      '{"protocol":"burrow","version":1,"contracts":{"BAD ID":{"methods":["execute"]}}}',
      '{"protocol":"burrow","version":1,"contracts":{"a.near":{"methods":["Exec Ute"]}}}',
      '{"protocol":"burrow","version":1,"contracts":{"a.near":{"methods":[1]}}}',
      '{"protocol":"burrow","version":1,"contracts":{"a.near":{}}}',
    ]) {
      expect(parseManifest(bad), bad).toBeNull();
    }
  });
});

describe("diffManifests", () => {
  it("is empty for identical manifests", () => {
    expect(diffManifests(BURROW_MANIFEST, BURROW_MANIFEST)).toEqual([]);
  });
  it("reports added contracts and methods", () => {
    const wider = { ...BURROW_MANIFEST, contracts: { [BURROW]: { methods: ["execute", "ft_transfer"] }, "new.near": { methods: ["execute"] } } };
    const d = diffManifests(BURROW_MANIFEST, wider).join(" ");
    expect(d).toContain("ft_transfer");
    expect(d).toContain("new.near");
  });
});

describe("loadTrustedManifest", () => {
  it("uses the built-in list when no registry is configured", async () => {
    const r = await loadTrustedManifest(undefined, "burrow");
    expect(r.source).toBe("built-in");
    expect(r.manifest).toEqual(BURROW_MANIFEST);
  });

  it("uses the registry manifest when it matches", async () => {
    const r = await loadTrustedManifest("registry.near", "burrow", fakeRpcs(entry()));
    expect(r.source).toBe("registry");
    expect(r.warnings).toEqual([]);
    expect(r.status).toBe("Ok");
  });

  it("warns when the alarm is not Ok", async () => {
    const r = await loadTrustedManifest(
      "registry.near",
      "burrow",
      fakeRpcs(entry({ status: "Compromised", status_note: "site script changed" })),
    );
    expect(r.warnings[0]).toContain("Compromised");
    expect(r.warnings[0]).toContain("site script changed");
  });

  it("falls back to built-in when the registry manifest is garbage", async () => {
    const r = await loadTrustedManifest("registry.near", "burrow", fakeRpcs(entry({ manifest: "{oops" })));
    expect(r.source).toBe("built-in");
  });

  it("falls back to built-in when the protocol is not registered", async () => {
    const r = await loadTrustedManifest("registry.near", "burrow", fakeRpcs(null));
    expect(r.source).toBe("built-in");
  });

  it("falls back when the registry cannot be read", async () => {
    const dead = { rpcs: ["https://a", "https://b"], fetchImpl: (async () => { throw new Error("down"); }) as unknown as typeof fetch };
    const r = await loadTrustedManifest("registry.near", "burrow", dead);
    expect(r.source).toBe("built-in");
    expect(r.warnings[0]).toContain("Could not read");
  });
});

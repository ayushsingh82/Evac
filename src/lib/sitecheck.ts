// Site fingerprint: hash every script a protocol's official page runs, so a swapped or injected script is noticed.
// Pure functions plus an injected fetcher, so the watcher and the tests share the same code.

export interface ScriptRef {
  /** Absolute URL for external scripts, undefined for inline code. */
  src?: string;
  inline?: string;
}

export interface Fingerprint {
  v: 1;
  /** key -> sha256 hex. Keys are absolute script URLs, or "inline:<n>" in page order. */
  scripts: Record<string, string>;
  /** Red flags found by static inspection of the page itself. */
  flags: string[];
}

export type SiteVerdict = "match" | "mismatch" | "unset";

export interface SiteComparison {
  verdict: SiteVerdict;
  added: string[];
  removed: string[];
  changed: string[];
  /** Added or changed scripts that load from an origin the baseline never used. */
  foreignOrigins: string[];
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Collapse whitespace differences so harmless reformatting does not change the hash. */
export function normalise(code: string): string {
  return code.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

/**
 * Inline snippets often carry per-request tokens (for example Cloudflare's bot-detection snippet). Replace long hex
 * strings, long token-like strings and long numbers with a placeholder so the fingerprint reflects the code's shape,
 * not the token. Changing the code itself still changes the hash.
 */
export function normaliseInline(code: string): string {
  return (
    normalise(code)
      // short-to-medium tokens that mix letters and digits (hex ids, base64 timestamps)
      .replace(/(?<![\w+/=-])(?=[\w+/=-]*\d)(?=[\w+/=-]*[A-Za-z])[\w+/=-]{12,}(?![\w+/=-])/g, "#")
      // long hex, long numbers, and very long token-like strings of any kind
      .replace(/\b[0-9a-fA-F]{12,}\b/g, "#")
      .replace(/\b\d{8,}\b/g, "#")
      .replace(/[A-Za-z0-9+/_=-]{32,}/g, "#")
  );
}

export function extractScripts(html: string, baseUrl: string): { scripts: ScriptRef[]; flags: string[] } {
  const scripts: ScriptRef[] = [];
  const flags: string[] = [];
  const tag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html))) {
    const attrs = m[1];
    const body = m[2];
    // JSON data blocks (for example __NEXT_DATA__) are never executed, so they are not part of the fingerprint.
    const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const t = (type?.[1] ?? type?.[2] ?? type?.[3] ?? "").trim().toLowerCase();
    if (t && !/^(text|application)\/(x-)?(java|ecma)script$/.test(t) && t !== "module" && t !== "importmap") continue;
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (src) {
      const raw = src[1] ?? src[2] ?? src[3];
      try {
        scripts.push({ src: new URL(raw, baseUrl).toString() });
      } catch {
        flags.push(`A script has an unreadable address: ${raw}`);
      }
    } else if (body.trim()) {
      scripts.push({ inline: body });
    }
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) flags.push("The page uses inline event handlers (onclick=...).");
  if (/href\s*=\s*["']\s*javascript:/i.test(html)) flags.push("The page has javascript: links.");
  return { scripts, flags };
}

export async function fingerprintPage(
  html: string,
  baseUrl: string,
  fetchScript: (url: string) => Promise<string>,
): Promise<Fingerprint> {
  const { scripts, flags } = extractScripts(html, baseUrl);
  const out: Record<string, string> = {};
  let inlineN = 0;
  for (const s of scripts) {
    if (s.src) {
      try {
        out[s.src] = await sha256Hex(normalise(await fetchScript(s.src)));
      } catch {
        out[s.src] = "unreachable";
        flags.push(`Could not fetch ${s.src}.`);
      }
    } else if (s.inline !== undefined) {
      out[`inline:${inlineN++}`] = await sha256Hex(normaliseInline(s.inline));
    }
  }
  return { v: 1, scripts: out, flags };
}

const originOf = (u: string): string | null => {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
};

export function compareFingerprint(baseline: Fingerprint | null, actual: Fingerprint): SiteComparison {
  if (!baseline) return { verdict: "unset", added: [], removed: [], changed: [], foreignOrigins: [] };
  const b = baseline.scripts;
  const a = actual.scripts;
  const added = Object.keys(a).filter((k) => !(k in b));
  const removed = Object.keys(b).filter((k) => !(k in a));
  const changed = Object.keys(a).filter((k) => k in b && a[k] !== b[k]);
  const known = new Set(Object.keys(b).map(originOf).filter((o): o is string => !!o));
  const foreignOrigins = [...added, ...changed]
    .map(originOf)
    .filter((o): o is string => !!o && !known.has(o));
  const clean = !added.length && !removed.length && !changed.length;
  return { verdict: clean ? "match" : "mismatch", added, removed, changed, foreignOrigins: [...new Set(foreignOrigins)] };
}

export function parseFingerprint(text: string): Fingerprint | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as Fingerprint;
    if (v && v.v === 1 && v.scripts && typeof v.scripts === "object") return v;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Turn a comparison into the alarm the watcher publishes.
 * Content-hashed file names change on every legitimate deploy, so a new same-origin file is only a "redeploy"
 * signal (Degraded). Different content behind the SAME url, a new inline script, or a new origin is the attack.
 */
export function decideStatus(c: SiteComparison, actual: Fingerprint): { status: "Ok" | "Degraded" | "Compromised"; note: string } {
  if (c.verdict === "unset") return { status: "Ok", note: "No site baseline is published yet." };
  if (c.foreignOrigins.length) {
    return { status: "Compromised", note: `New script from an unknown origin: ${c.foreignOrigins.join(", ")}`.slice(0, 280) };
  }
  if (c.changed.length) {
    return { status: "Compromised", note: `A script changed behind the same address: ${c.changed[0]}`.slice(0, 280) };
  }
  if (c.added.some((k) => k.startsWith("inline:"))) {
    return { status: "Compromised", note: "A new inline script appeared on the page." };
  }
  if (c.added.length || c.removed.length) {
    return {
      status: "Degraded",
      note: `Site files changed (${c.added.length} new, ${c.removed.length} missing). If this was a deploy, publish a new fingerprint.`,
    };
  }
  if (actual.flags.length) return { status: "Degraded", note: actual.flags[0].slice(0, 280) };
  return { status: "Ok", note: "Site matches the published fingerprint." };
}

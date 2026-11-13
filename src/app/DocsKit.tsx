"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type TocGroup = { title: string; items: { id: string; label: string }[] };

/** Docs layout: a static sidebar on the left; the right pane swaps to the topic you select. */
export function DocsShell({ groups, sections }: { groups: TocGroup[]; sections: Record<string, ReactNode> }) {
  const flat = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(flat[0]?.id);
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const pane = useRef<HTMLDivElement>(null);

  const select = (id: string) => {
    setActive(id);
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
    if (pane.current) window.scrollTo({ top: Math.max(0, pane.current.offsetTop - 80), behavior: "smooth" });
  };

  useEffect(() => {
    // Open the topic named in the URL (#guard), and follow later hash changes.
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (flat.some((i) => i.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const term = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !term || i.label.toLowerCase().includes(term)) }))
    .filter((g) => g.items.length);
  const idx = Math.max(0, flat.findIndex((i) => i.id === active));
  const group = groups.find((g) => g.items.some((i) => i.id === active));
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  return (
    <main className="doc">
      <aside className="doc-side">
        <div className="doc-head">
          <b>Documentation</b>
          <span>{idx + 1} of {flat.length}</span>
        </div>
        <div className="doc-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter topics" aria-label="Filter topics" />
          {q && <button type="button" className="doc-clear" aria-label="Clear filter" onClick={() => setQ("")}>✕</button>}
        </div>
        <nav className="doc-nav">
          {shown.length === 0 && <p className="doc-none">No topic matches &ldquo;{q}&rdquo;.</p>}
          {shown.map((g) => {
            const open = term ? true : !closed[g.title];
            return (
              <div className="toc-g" key={g.title}>
                <button type="button" className="toc-h" aria-expanded={open} onClick={() => setClosed((c) => ({ ...c, [g.title]: open }))}>
                  <span>{g.title}</span>
                  <i className={open ? "open" : ""} aria-hidden>›</i>
                </button>
                {open &&
                  g.items.map((i) => (
                    <a
                      key={i.id}
                      href={`#${i.id}`}
                      className={active === i.id ? "on" : ""}
                      aria-current={active === i.id ? "page" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        select(i.id);
                      }}
                    >
                      {i.label}
                    </a>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="doc-side-foot">
          <a href="/dashboard" className="dbtn solid wide">Open Evac</a>
          <div className="doc-links">
            <a href="/kit">Save the kit</a>
            <a href="/extension">Extension</a>
          </div>
        </div>
      </aside>

      <div className="doc-pane" ref={pane}>
        <article key={active}>
          <div className="label">{group?.title}</div>
          {active && sections[active]}
          <div className="doc-pager">
            {prev ? (
              <button type="button" onClick={() => select(prev.id)}><small>Previous</small><span>← {prev.label}</span></button>
            ) : <i />}
            {next ? (
              <button type="button" className="next" onClick={() => select(next.id)}><small>Next</small><span>{next.label} →</span></button>
            ) : <i />}
          </div>
        </article>
      </div>
    </main>
  );
}

/** A code block with a copy button. */
export function Code({ children, label }: { children: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{label ?? "shell"}</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(children);
              setDone(true);
              setTimeout(() => setDone(false), 1400);
            } catch {
              /* clipboard unavailable: ignore */
            }
          }}
        >
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

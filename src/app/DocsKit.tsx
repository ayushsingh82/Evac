"use client";

import { useEffect, useState } from "react";

export type TocGroup = { title: string; items: { id: string; label: string }[] };

/** Docs sidebar: reading progress, collapsible groups, a filter box, and the section being read highlighted. */
export function DocsToc({ groups }: { groups: TocGroup[] }) {
  const flat = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(flat[0]?.id);
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    // The active section is the last heading that has scrolled past a line near the top of the screen.
    let raf = 0;
    const update = () => {
      raf = 0;
      let cur = flat[0]?.id;
      for (const i of flat) {
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top < 140) cur = i.id;
      }
      setActive(cur);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const term = q.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !term || i.label.toLowerCase().includes(term)) }))
    .filter((g) => g.items.length);
  const activeIdx = Math.max(0, flat.findIndex((i) => i.id === active));
  return (
    <aside className="doc-side">
      <div className="doc-head">
        <b>Documentation</b>
        <span>{activeIdx + 1} of {flat.length}</span>
      </div>
      <div className="doc-prog" aria-hidden><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      <div className="doc-search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter sections" aria-label="Filter sections" />
        {q && <button type="button" className="doc-clear" aria-label="Clear filter" onClick={() => setQ("")}>✕</button>}
      </div>
      {shown.length === 0 && <p className="doc-none">No section matches &ldquo;{q}&rdquo;.</p>}
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
                <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : ""}>
                  {i.label}
                </a>
              ))}
          </div>
        );
      })}
      <div className="doc-side-foot">
        <a href="/dashboard" className="dbtn solid wide">Open Evac</a>
        <div className="doc-links">
          <a href="/kit">Save the kit</a>
          <a href="/extension">Extension</a>
        </div>
      </div>
    </aside>
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

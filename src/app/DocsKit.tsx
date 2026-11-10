"use client";

import { useEffect, useState } from "react";

export type TocGroup = { title: string; items: { id: string; label: string }[] };

/** Docs sidebar: grouped sections, a filter box, and the section being read highlighted. */
export function DocsToc({ groups }: { groups: TocGroup[] }) {
  const flat = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(flat[0]?.id);
  const [q, setQ] = useState("");
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
  return (
    <aside className="doc-side">
      <div className="doc-search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter sections" aria-label="Filter sections" />
      </div>
      {groups.map((g) => {
        const items = g.items.filter((i) => !term || i.label.toLowerCase().includes(term));
        if (!items.length) return null;
        return (
          <div className="toc-g" key={g.title}>
            <div className="side-sec">{g.title}</div>
            {items.map((i) => (
              <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : ""}>
                {i.label}
              </a>
            ))}
          </div>
        );
      })}
      <div className="doc-side-foot">
        <a href="/dashboard" className="dbtn solid wide">Open Evac</a>
        <a href="https://github.com/ayushsingh82/Evac" className="doc-ext">GitHub ↗</a>
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

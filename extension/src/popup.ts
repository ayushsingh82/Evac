import type { Tracked } from "./logic";
declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const app = document.getElementById("app")!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

chrome.runtime.sendMessage({ type: "state" }, (s: { tracked: Tracked[]; at: number; error: string; config: { evacUrl: string } }) => {
  const rows = (s?.tracked ?? [])
    .map((t) => {
      if (!t.entry) return `<div class="card"><b>${esc(t.protocol)}</b> <span class="chip warn">not registered</span></div>`;
      const e = t.entry;
      const cls = e.status === "Ok" ? "" : e.status === "Compromised" ? "bad" : "warn";
      return `<div class="card"><b>${esc(t.protocol)}</b> <span class="chip ${cls}">${esc(e.status)}</span>
        <div class="muted">Official site: ${esc(e.url || "not set")}</div>
        <div class="muted">${e.blocklist.length} look-alike address${e.blocklist.length === 1 ? "" : "es"} blocked</div>
        ${e.status_note ? `<div class="muted">${esc(e.status_note)}</div>` : ""}</div>`;
    })
    .join("");
  app.innerHTML = `<h1>Evac guard</h1>${rows || ""}${s?.error ? `<p class="muted">${esc(s.error)}</p>` : ""}
    <a class="btn" id="open">Open Evac</a> <a class="muted" id="opt" href="#">Settings</a>`;
  document.getElementById("open")!.addEventListener("click", () => chrome.tabs.create({ url: s?.config?.evacUrl }));
  document.getElementById("opt")!.addEventListener("click", (ev) => { ev.preventDefault(); chrome.runtime.openOptionsPage(); });
});

import { bannerText, type PageVerdict } from "./logic";

declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any

function show(level: "bad" | "warn", title: string, body: string) {
  const host = document.createElement("div");
  host.setAttribute("data-evac-banner", level);
  host.style.cssText = "all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647";
  const root = host.attachShadow({ mode: "closed" });
  const bg = level === "bad" ? "#9c3929" : "#805616";
  root.innerHTML = `<div style="font:15px/1.45 system-ui,sans-serif;background:${bg};color:#fff;padding:12px 16px;display:flex;gap:14px;align-items:center">
    <div style="flex:1"><b>${esc(title)}</b><div style="opacity:.92">${esc(body)}</div></div>
    <button style="all:unset;cursor:pointer;padding:6px 12px;border-radius:8px;background:#fff;color:#111;font-weight:600">Dismiss</button></div>`;
  root.querySelector("button")!.addEventListener("click", () => host.remove());
  document.documentElement.appendChild(host);
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

if (location.protocol === "http:" || location.protocol === "https:") {
  chrome.runtime.sendMessage({ type: "judge", url: location.href }, (v: PageVerdict | null) => {
    if (chrome.runtime.lastError || !v) return;
    const b = bannerText(v);
    if (b) show(b.level, b.title, b.body);
  });
}

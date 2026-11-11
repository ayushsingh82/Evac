declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
chrome.storage.local.get("config").then((s: { config?: { registry: string; protocols: string[]; evacUrl: string } }) => {
  const c = s.config;
  $("registry").value = c?.registry ?? "";
  $("protocols").value = (c?.protocols ?? ["burrow"]).join(", ");
  $("evac").value = c?.evacUrl ?? "http://localhost:3001/dashboard";
});
$("save").addEventListener("click", () => {
  const config = {
    registry: $("registry").value.trim(),
    protocols: $("protocols").value.split(",").map((x) => x.trim()).filter(Boolean),
    evacUrl: $("evac").value.trim(),
  };
  chrome.runtime.sendMessage({ type: "save", config }, () => ($("msg") as unknown as HTMLElement).textContent = "Saved.");
});

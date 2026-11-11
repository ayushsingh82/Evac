declare const chrome: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const $ = (id: string) => document.getElementById(id) as HTMLInputElement & HTMLTextAreaElement;
chrome.storage.local.get("config").then((s: { config?: { registry: string; protocols: string[]; evacUrl: string } }) => {
  const c = s.config;
  $("registry").value = c?.registry ?? "";
  $("protocols").value = (c?.protocols ?? ["burrow"]).join(", ");
  $("evac").value = c?.evacUrl ?? "http://localhost:3001/dashboard";
  $("demo").value = (c as { demo?: string } | undefined)?.demo ?? "";
});
$("save").addEventListener("click", () => {
  const config = {
    registry: $("registry").value.trim(),
    protocols: $("protocols").value.split(",").map((x) => x.trim()).filter(Boolean),
    evacUrl: $("evac").value.trim(),
    demo: $("demo").value.trim(),
  };
  chrome.runtime.sendMessage({ type: "save", config }, () => ($("msg") as unknown as HTMLElement).textContent = "Saved.");
});

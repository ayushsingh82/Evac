// Build the Chrome extension into extension/dist. Load that folder via chrome://extensions -> Developer mode -> Load unpacked.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
rmSync("extension/dist", { recursive: true, force: true });
mkdirSync("extension/dist", { recursive: true });
await build({
  entryPoints: { background: "extension/src/background.ts", content: "extension/src/content.ts", popup: "extension/src/popup.ts", options: "extension/src/options.ts" },
  outdir: "extension/dist",
  bundle: true,
  format: "esm",
  target: "chrome110",
  minify: false,
  logLevel: "info",
});
cpSync("extension/manifest.json", "extension/dist/manifest.json");
cpSync("extension/public", "extension/dist", { recursive: true });
console.log("built extension/dist");

import { context } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });
copyFileSync("src/panel.css", "dist/panel.css");
copyFileSync("src/popup.html", "dist/popup.html");

const contentCtx = await context({
  entryPoints: ["src/content.ts"],
  bundle: true,
  outfile: "dist/content.js",
  format: "iife",
  target: "chrome120",
  sourcemap: true
});

const popupCtx = await context({
  entryPoints: ["src/popup.ts"],
  bundle: true,
  outfile: "dist/popup.js",
  format: "iife",
  target: "chrome120",
  sourcemap: true
});

await contentCtx.rebuild();
await popupCtx.rebuild();
copyFileSync("src/panel.css", "dist/panel.css");
copyFileSync("src/popup.html", "dist/popup.html");

if (watch) {
  await contentCtx.watch();
  await popupCtx.watch();
  console.log("Extension build finished, watching for changes");
} else {
  await contentCtx.dispose();
  await popupCtx.dispose();
  console.log("Extension build finished");
}

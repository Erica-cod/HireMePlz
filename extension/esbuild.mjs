import { context } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });
copyFileSync("src/panel.css", "dist/panel.css");

const ctx = await context({
  entryPoints: ["src/content.ts"],
  bundle: true,
  outfile: "dist/content.js",
  format: "iife",
  target: "chrome120",
  sourcemap: true
});

await ctx.rebuild();
copyFileSync("src/panel.css", "dist/panel.css");

if (watch) {
  await ctx.watch();
  console.log("Extension build finished, watching for changes");
} else {
  await ctx.dispose();
  console.log("Extension build finished");
}

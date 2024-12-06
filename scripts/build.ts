import { build } from "bun";

await build({
  target: "bun",
  entrypoints: ["./src/index.ts"],
  outdir: "dist",
});

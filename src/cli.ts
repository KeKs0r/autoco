import { parseArgs } from "util";
import { runApp } from "./app";

export async function run() {
  const { values, positionals } = parseArgs({
    options: {
      force: {
        type: "boolean",
        short: "f",
        default: false,
      },
    },
    allowPositionals: true,
  });

  // If a directory is provided as first positional argument, use it
  if (positionals[0]) {
    process.env["PWD"] = positionals[0];
  }

  await runApp({ force: values.force });
}

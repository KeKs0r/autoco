import { parseArgs } from "util";
import { runApp } from "./app";

export async function run() {
  const { values } = parseArgs({
    options: {
      force: {
        type: "boolean",
        short: "f",
        default: false,
      },
    },
  });

  await runApp({ force: values.force });
}

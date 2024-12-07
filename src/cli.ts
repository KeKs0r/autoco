import { parseArgs } from "util";
import { runApp } from "./app";

export async function run() {
  const {} = parseArgs({
    args: Bun.argv,
    // options: {
    //   flag1: {
    //     type: "boolean",
    //   },
    //   flag2: {
    //     type: "string",
    //   },
    // },
    strict: true,
    allowPositionals: true,
  });

  // console.log(values);
  // console.log(positionals);

  await runApp();
}

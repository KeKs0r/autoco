import { log } from "@clack/prompts";
import color from "picocolors";
import { getGit } from "../git";
import { S_BAR } from "../tui";

export async function addMissingFiles(files: string[]) {
  const g = await getGit();
  log.step("Adding missing files");
  await g.add(files);
  for (const file of files) {
    console.log(color.gray(S_BAR), " " + color.dim(file));
  }
}

import { log } from "@clack/prompts";
import color from "picocolors";
import type { CommitInput } from "./git";

export const S_BAR = "│";

export function renderCommits(commits: CommitInput[]) {
  for (const commit of commits) {
    const m = commit.message;
    log.message(m);
    for (const file of commit.files) {
      console.log(
        color.gray(S_BAR),
        m.includes(":") ? "     " : "    " + color.dim(file)
      );
    }
  }
}

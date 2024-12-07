import { log } from "@clack/prompts";
import type { CommitInput } from "./git";

export function renderCommits(commits: CommitInput[]) {
  for (const commit of commits) {
    log.message(commit.message);
    for (const file of commit.files) {
      console.log("│", "    " + file);
    }
    log.message("  ");
  }
}

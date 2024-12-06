import type { CommitInput } from "./git";

export function renderCommits(commits: CommitInput[]) {
  for (const commit of commits) {
    console.log(commit.message);
    for (const file of commit.files) {
      console.log("   ", file);
    }
  }
  console.log("");
}

import { confirm, spinner } from "@clack/prompts";
import { generateCommits } from "./generate-commits";
import { commitFiles, getDiff, getStatus } from "./git";
import { renderCommits } from "./tui";

export async function runApp() {
  const status = await getStatus();
  if (status.isClean()) {
    console.log("Everything is clean, nothing to commmit");
    console.log(status);
    return;
  }
  const diff = await getDiff();
  const s = spinner();
  s.start("Generating commits...");
  const commits = await generateCommits({ diff });
  s.stop("Generated commits");
  renderCommits(commits);
  const shouldCommit = await confirm({
    message: "Do you want to commit?",
  });
  if (shouldCommit) {
    await commitFiles(commits);
  }
}

import { confirm, spinner, intro, outro, log } from "@clack/prompts";
import { Chalk } from "chalk";
import { generateCommits } from "./generate-commits";
import { commitFiles, getDiff, getStatus } from "./git";
import { renderCommits } from "./tui";

const color = new Chalk();

export async function runApp() {
  intro("Comitting your changes");
  const status = await getStatus();
  if (status.isClean()) {
    outro("Everything is clean, nothing to commmit");
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
  console.log("ShouldCommit", shouldCommit);
  if (shouldCommit) {
    await commitFiles(commits);
  } else {
    outro("not done anything");
  }
}

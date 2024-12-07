import { confirm, spinner, intro, outro, isCancel } from "@clack/prompts";

import { generateCommits } from "./generate-commits";
import { commitFiles, getDiff, getStatus } from "./git";
import { renderCommits } from "./tui";
import { stringLengthToBytes } from "./util";

export async function runApp() {
  intro("Comitting your changes");
  const status = await getStatus();
  if (status.isClean()) {
    outro("Everything is clean, nothing to commmit");
    return;
  }
  const dSpinner = spinner();
  dSpinner.start("Getting diff...");
  const diff = await getDiff();
  dSpinner.stop(`Got diff (${stringLengthToBytes(diff.length)})`);

  const s = spinner();
  s.start("Generating commits...");
  const commits = await generateCommits({ diff });
  s.stop("Generated commits");

  renderCommits(commits);
  const shouldCommit = await confirm({
    message: "Do you want to commit?",
  });
  if (isCancel(shouldCommit)) {
    outro("Cancelled");
  } else if (shouldCommit) {
    await commitFiles(commits);
  } else {
    outro("not done anything");
  }
}

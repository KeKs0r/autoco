import { confirm, spinner, intro, outro, isCancel } from "@clack/prompts";

import { generateCommits } from "./steps/generate-commits";
import { commitFiles, getDiff, getGit, getStatus } from "./git";
import { renderCommits } from "./tui";
import { stringLengthToBytes } from "./util";
import { addMissingFiles } from "./steps/add-missing";

export async function runApp() {
  // console.log(process.env["PWD"]);
  intro("Comitting your changes");
  const status = await getStatus();
  // console.log(status);
  if (status.isClean()) {
    outro("Everything is clean, nothing to commmit");
    return;
  }

  if (status.not_added.length) {
    await addMissingFiles(status.not_added);
  }

  const dSpinner = spinner();
  dSpinner.start("Getting diff...");
  const diff = await getDiff({
    staged: Boolean(status.staged.length) || Boolean(status.not_added.length),
  });
  dSpinner.stop(`Got diff (${stringLengthToBytes(diff.length)})`);

  if (!diff.length) {
    outro("No diff, exit");
    return;
  }
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
    return;
  } else if (!shouldCommit) {
    outro("not done anything");
    return;
  }

  await commitFiles(commits);

  await (await getGit()).push();
  outro("Pushed changes");
}

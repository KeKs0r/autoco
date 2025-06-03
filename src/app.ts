import { confirm, spinner, intro, outro, isCancel } from "@clack/prompts";

import { generateCommits } from "./steps/generate-commits";
import { getDiff, getDiffForAI, getGit, getStatus } from "./git";
import { renderCommits } from "./tui";
import { stringLengthToBytes } from "./util";
import { addMissingFiles } from "./steps/add-missing";
import { commitFiles } from "./steps/commit-files";

export interface RunAppOptions {
  force?: boolean;
}

export async function runApp({ force = false }: RunAppOptions = {}) {
  // console.log(process.env["PWD"]);
  intro("Comitting your changes");
  const status = await getStatus();
  // console.log(status);
  if (status.isClean()) {
    outro("Everything is clean, nothing to commmit");
    return;
  }

  // Stage all changes to ensure everything is included
  const g = await getGit();
  
  if (status.not_added.length) {
    await addMissingFiles(status.not_added);
  }

  // Stage modified files
  if (status.modified.length > 0) {
    await g.add(status.modified);
  }

  // Stage deleted files 
  if (status.deleted.length > 0) {
    await g.rm(status.deleted);
  }

  // Handle renamed files (stage both old and new)
  if (status.renamed.length > 0) {
    for (const rename of status.renamed) {
      await g.rm(rename.from);
      await g.add(rename.to);
    }
  }

  const dSpinner = spinner();
  dSpinner.start("Getting diff...");
  const diffForAI = await getDiffForAI({
    staged: true, // Always use staged diff since we stage everything above
  });
  dSpinner.stop(`Got diff (${stringLengthToBytes(diffForAI.length)})`);

  if (!diffForAI.length) {
    outro("No diff, exit");
    return;
  }
  const s = spinner();
  s.start("Generating commits...");
  const commits = await generateCommits({ diff: diffForAI });
  s.stop("Generated commits");

  renderCommits(commits);

  if (!force) {
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
  }

  await commitFiles(commits, status);

  await (await getGit()).push();
  outro("Pushed changes");
}

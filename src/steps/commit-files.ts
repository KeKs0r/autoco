import type { StatusResult } from "simple-git";
import { getGit, type CommitInput } from "../git";

export async function commitFiles(
  commits: CommitInput[],
  status: StatusResult
) {
  const g = await getGit();
  const cleaned = cleanRenamedFiles(commits, status);
  for (const commit of cleaned) {
    // For deleted files, we need to use git rm
    const deletedFiles = commit.files.filter((file) =>
      status.deleted.includes(file)
    );
    const otherFiles = commit.files.filter(
      (file) => !status.deleted.includes(file)
    );

    if (deletedFiles.length > 0) {
      await g.rm(deletedFiles);
    }
    if (otherFiles.length > 0) {
      await g.add(otherFiles);
    }
    await g.commit(commit.message, commit.files, {});
  }
}

/**
 * @TODO: renamed files only add new file, dont delete old one
 */
function cleanRenamedFiles(
  commits: CommitInput[],
  status: StatusResult
): CommitInput[] {
  return commits
    .map((commit) => {
      return {
        ...commit,
        files: commit.files.map((file) => {
          const renamed = status.renamed.find((r) => r.from === file);
          return renamed ? renamed.to : file;
        }),
      };
    })
    .filter((a) => a.files.length > 0);
}

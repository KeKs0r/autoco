import type { StatusResult } from "simple-git";
import { getGit, type CommitInput } from "../git";

export async function commitFiles(
  commits: CommitInput[],
  status: StatusResult
) {
  const g = await getGit();
  const cleaned = cleanRenamedFiles(commits, status);
  for (const commit of cleaned) {
    await g.add(commit.files);
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
        files: commit.files
          .map((file) => {
            const renamed = status.renamed.find((r) => r.from === file);
            return renamed ? renamed.to : file;
          })
          .filter((file) => !status.deleted.includes(file)),
      };
    })
    .filter((a) => a.files.length > 0);
}

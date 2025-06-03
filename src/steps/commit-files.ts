import type { StatusResult } from "simple-git";
import { getGit, type CommitInput } from "../git";

export async function commitFiles(
  commits: CommitInput[],
  status: StatusResult
) {
  const g = await getGit();
  const cleaned = cleanRenamedFiles(commits, status);
  for (const commit of cleaned) {
    // Categorize files by their status
    const deletedFiles = commit.files.filter((file) =>
      status.deleted.includes(file)
    );
    const renamedFromFiles = commit.files.filter((file) =>
      status.renamed.some((r) => r.from === file)
    );
    const renamedToFiles = commit.files.filter((file) =>
      status.renamed.some((r) => r.to === file)
    );
    const otherFiles = commit.files.filter(
      (file) => 
        !status.deleted.includes(file) && 
        !status.renamed.some((r) => r.from === file || r.to === file)
    );

    // Handle deleted files
    if (deletedFiles.length > 0) {
      await g.rm(deletedFiles);
    }
    
    // Handle renamed files (remove old, add new)
    if (renamedFromFiles.length > 0) {
      await g.rm(renamedFromFiles);
    }
    if (renamedToFiles.length > 0) {
      await g.add(renamedToFiles);
    }
    
    // Handle other files (normal add)
    if (otherFiles.length > 0) {
      await g.add(otherFiles);
    }
    
    await g.commit(commit.message, commit.files, {});
  }
}

function cleanRenamedFiles(
  commits: CommitInput[],
  status: StatusResult
): CommitInput[] {
  return commits
    .map((commit) => {
      const updatedFiles: string[] = [];
      
      for (const file of commit.files) {
        const renamed = status.renamed.find((r) => r.from === file);
        if (renamed) {
          // For renamed files, we need to stage both the removal of old file and addition of new file
          updatedFiles.push(renamed.from, renamed.to);
        } else {
          updatedFiles.push(file);
        }
      }
      
      return {
        ...commit,
        files: [...new Set(updatedFiles)], // Remove duplicates
      };
    })
    .filter((a) => a.files.length > 0);
}

import type { StatusResult } from "simple-git";
import { getGit, type CommitInput } from "../git";
import fs from "fs";
import path from "path";

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
      // Process each deleted file individually to handle missing files gracefully
      for (const file of deletedFiles) {
        try {
          await g.rm([file]);
        } catch (error) {
          // Skip files that don't exist - they may have been manually staged for deletion
          if (error.message?.includes('pathspec') && error.message?.includes('did not match any files')) {
            console.warn(`Skipping ${file} - file does not exist`);
            continue;
          }
          throw error;
        }
      }
    }
    
    // Handle renamed files (remove old, add new)
    if (renamedFromFiles.length > 0) {
      // Process each renamed file individually to handle missing files gracefully
      for (const file of renamedFromFiles) {
        try {
          await g.rm([file]);
        } catch (error) {
          // Skip files that don't exist - they may have been manually staged for deletion
          if (error.message?.includes('pathspec') && error.message?.includes('did not match any files')) {
            console.warn(`Skipping ${file} - file does not exist`);
            continue;
          }
          throw error;
        }
      }
    }
    if (renamedToFiles.length > 0) {
      await g.add(renamedToFiles);
    }
    
    // Handle other files (normal add, skip ignored files)
    if (otherFiles.length > 0) {
      for (const file of otherFiles) {
        try {
          await g.add(file);
        } catch (error) {
          // Skip files that are ignored by .gitignore
          if (error.message?.includes('ignored by one of your .gitignore files')) {
            console.warn(`Skipping ${file} - ignored by .gitignore`);
            continue;
          }
          // Skip files that don't exist (LLM hallucination)
          if (error.message?.includes('pathspec') && error.message?.includes('did not match any files')) {
            const suggestion = await findSimilarFile(file);
            if (suggestion) {
              console.warn(`Skipping ${file} - file does not exist. Did you mean: ${suggestion}?`);
            } else {
              console.warn(`Skipping ${file} - file does not exist (potential LLM hallucination)`);
            }
            continue;
          }
          throw error;
        }
      }
    }
    
    // Filter out files that don't exist to avoid commit errors
    const validFiles = [];
    for (const file of commit.files) {
      try {
        // Check if file exists in index (staged) or working directory
        const status = await g.status();
        const existsInStaged = status.staged.includes(file) || status.deleted.includes(file) || 
                              status.renamed.some(r => r.from === file || r.to === file) ||
                              status.modified.includes(file) || status.not_added.includes(file);
        if (existsInStaged) {
          validFiles.push(file);
        }
      } catch {
        // If we can't determine status, skip the file
      }
    }
    
    if (validFiles.length > 0) {
      await g.commit(commit.message, validFiles, {});
    }
  }
}

async function findSimilarFile(missingFile: string): Promise<string | null> {
  try {
    // Get all files in the repository
    const g = await getGit();
    const files = await g.raw(['ls-files']);
    const allFiles = files.split('\n').filter(f => f.trim());
    
    // Simple fuzzy matching: find files with similar names
    const fileName = path.basename(missingFile);
    const dirName = path.dirname(missingFile);
    
    // Look for exact filename matches in different directories
    const exactNameMatches = allFiles.filter(f => path.basename(f) === fileName);
    if (exactNameMatches.length > 0) {
      return exactNameMatches[0];
    }
    
    // Look for similar directory structures
    const similarDirMatches = allFiles.filter(f => {
      const fDir = path.dirname(f);
      return fDir.includes('ingestion') && missingFile.includes('ingestion');
    });
    
    if (similarDirMatches.length > 0) {
      return similarDirMatches[0];
    }
    
    return null;
  } catch {
    return null;
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

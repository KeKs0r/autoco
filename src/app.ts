import { confirm, spinner, intro, outro, isCancel } from "@clack/prompts";

import { generateCommits } from "./steps/generate-commits";
import { getDiff, getDiffForAI, getGit, getStatus, type CommitInput } from "./git";
import type { StatusResult } from "simple-git";
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

  // Stage modified files (skip ignored files)
  if (status.modified.length > 0) {
    for (const file of status.modified) {
      try {
        await g.add(file);
      } catch (error) {
        // Skip files that are ignored by .gitignore
        if (error.message?.includes('ignored by one of your .gitignore files')) {
          continue;
        }
        throw error;
      }
    }
  }

  // Stage deleted files 
  if (status.deleted.length > 0) {
    // Process each deleted file individually to handle missing files gracefully
    for (const file of status.deleted) {
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

  // Handle renamed files (stage both old and new)
  if (status.renamed.length > 0) {
    for (const rename of status.renamed) {
      try {
        await g.rm(rename.from);
        await g.add(rename.to);
      } catch (error) {
        // Skip files that are ignored by .gitignore
        if (error.message?.includes('ignored by one of your .gitignore files')) {
          continue;
        }
        // Handle files that don't exist in HEAD
        if (error.message?.includes('pathspec') && error.message?.includes('did not match any files')) {
          try {
            await g.add(rename.to);
          } catch (addError) {
            if (addError.message?.includes('ignored by one of your .gitignore files')) {
              continue;
            }
            throw addError;
          }
          continue;
        }
        throw error;
      }
    }
  }

  const dSpinner = spinner();
  dSpinner.start("Getting diff...");
  const diffResult = await getDiffForAI({
    staged: true, // Always use staged diff since we stage everything above
  });
  
  // Create user-friendly message about diff processing
  let diffMessage = `Got diff (${stringLengthToBytes(diffResult.filteredSize)})`;
  
  if (diffResult.excludedFiles.length > 0) {
    const originalSize = stringLengthToBytes(diffResult.originalSize);
    const savings = ((diffResult.originalSize - diffResult.filteredSize) / diffResult.originalSize * 100).toFixed(1);
    diffMessage += ` • Excluded ${diffResult.excludedFiles.length} file(s) (${savings}% reduction from ${originalSize})`;
  }
  
  dSpinner.stop(diffMessage);

  // Check if we have only lock files
  const allStagedFiles = Array.from(new Set([
    ...status.staged,
    ...status.modified.filter(() => true),
    ...status.deleted,
    ...status.renamed.map(r => r.to),
  ]));
  
  const lockFilePatterns = [
    /.*\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /bun\.lockb$/,
    /bun\.lock$/,
    /Pipfile\.lock$/,
    /poetry\.lock$/,
    /Cargo\.lock$/,
    /composer\.lock$/,
  ];
  
  const stagedLockFiles = allStagedFiles.filter(file =>
    lockFilePatterns.some(pattern => pattern.test(file))
  );
  
  if (!diffResult.diff.length) {
    // If we have lock files but no diff, create a commit for them
    if (stagedLockFiles.length > 0) {
      const lockFileCommit: CommitInput = {
        message: "🔒 Update lock files",
        files: stagedLockFiles,
      };
      renderCommits([lockFileCommit]);
      
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
      
      await commitFiles([lockFileCommit], status);
      await (await getGit()).push();
      outro("Pushed changes");
      return;
    }
    
    outro("No diff, exit");
    return;
  }
  const s = spinner();
  s.start("Generating commits...");
  const result = await generateCommits({ diff: diffResult.diff });
  const providerName = result.provider === "anthropic" ? "Anthropic" : "OpenAI";
  const fallbackText = result.usedFallback ? ` (Fallback: ${providerName})` : ` (${providerName})`;
  s.stop(`Generated commits${fallbackText}`);

  // Ensure lock files are included in commits even if AI didn't see them in diff
  const enhancedCommits = await enhanceCommitsWithLockFiles(result.commits, status);

  renderCommits(enhancedCommits);

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

  await commitFiles(enhancedCommits, status);

  await (await getGit()).push();
  outro("Pushed changes");
}

async function enhanceCommitsWithLockFiles(
  commits: CommitInput[],
  status: StatusResult
): Promise<CommitInput[]> {
  // Lock file patterns to detect
  const lockFilePatterns = [
    /.*\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /bun\.lockb$/,
    /bun\.lock$/, // Add bun.lock explicitly
    /Pipfile\.lock$/,
    /poetry\.lock$/,
    /Cargo\.lock$/,
    /composer\.lock$/,
  ];

  // Get all staged files
  const allStagedFiles = [
    ...status.staged,
    ...status.not_added, // Files that were just added
    ...status.modified.filter(() => true), // Modified files that got staged
    ...status.deleted,
    ...status.renamed.map(r => r.to),
  ];

  // Find staged lock files
  const stagedLockFiles = allStagedFiles.filter(file =>
    lockFilePatterns.some(pattern => pattern.test(file))
  );

  if (stagedLockFiles.length === 0) {
    return commits;
  }

  // Find files already mentioned in commits
  const filesInCommits = new Set(
    commits.flatMap(commit => commit.files)
  );

  // Find lock files not yet included in any commit
  const unincludedLockFiles = stagedLockFiles.filter(
    file => !filesInCommits.has(file)
  );

  if (unincludedLockFiles.length === 0) {
    return commits;
  }

  // Find a commit that mentions dependency-related files to add lock files to
  const dependencyCommitIndex = commits.findIndex(commit =>
    commit.files.some(file => 
      file.includes('package.json') || 
      file.includes('Cargo.toml') || 
      file.includes('pyproject.toml') ||
      file.includes('Pipfile') ||
      file.includes('composer.json')
    )
  );

  if (dependencyCommitIndex >= 0) {
    // Add lock files to the dependency commit
    return commits.map((commit, index) => 
      index === dependencyCommitIndex
        ? { ...commit, files: [...commit.files, ...unincludedLockFiles] }
        : commit
    );
  } else {
    // Create a new commit for lock files if no dependency commit exists
    return [
      ...commits,
      {
        message: "🔒 Update lock files",
        files: unincludedLockFiles,
      },
    ];
  }
}

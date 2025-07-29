import assert from "assert";
import { join } from "path";
import simpleGit, { CheckRepoActions, type SimpleGit } from "simple-git";
import { z } from "zod";
import { minimatch } from "minimatch";
import { getConfig } from "./config";

let git: SimpleGit | undefined;
export async function getGit() {
  if (!git) {
    const root = await getGitRootFromPWD();
    git = simpleGit({ baseDir: root });
  }

  return git;
}

export const CommitInputSchema = z.object({
  message: z.string().describe("The generated commit message"),
  files: z
    .array(z.string())
    .describe("The files for which the message should be used"),
});

export type CommitInput = z.infer<typeof CommitInputSchema>;

export async function getStatus() {
  const g = await getGit();
  return g.status();
}

interface DiffOptions {
  staged?: boolean;
}

function isTruthy(value: string | null): value is string {
  return Boolean(value);
}

export async function getDiff(options?: DiffOptions) {
  const g = await getGit();
  return g.diff([options?.staged ? "--cached" : null].filter(isTruthy));
}

export async function getDiffForAI(options?: DiffOptions): Promise<{
  diff: string;
  originalSize: number;
  filteredSize: number;
  excludedFiles: string[];
}> {
  const rawDiff = await getDiff(options);
  const lockFilesFiltered = filterLockFiles(rawDiff);
  const config = await getConfig();
  const result = filterContentByGlobs(lockFilesFiltered, config.ACO_EXCLUDE_CONTENT_GLOBS || []);
  
  return {
    diff: result.diff,
    originalSize: rawDiff.length,
    filteredSize: result.diff.length,
    excludedFiles: result.excludedFiles,
  };
}

function filterLockFiles(diff: string): string {
  // Common lock file names to filter
  const lockFileNames = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    'Pipfile.lock',
    'poetry.lock',
    'Cargo.lock',
    'composer.lock',
    '*.lock', // Generic lock files
  ];

  let filteredDiff = diff;
  
  // For each lock file, remove the entire diff section
  for (const fileName of lockFileNames) {
    // Escape special regex characters in filename
    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Handle wildcards
    const filePattern = escapedFileName.replace(/\\\*/g, '.*');
    
    // Pattern to match the entire diff section for this file
    // This handles both text and binary files
    // Use [\s\S] to match any character including newlines
    const pattern = new RegExp(
      `diff --git a\/${filePattern} b\/${filePattern}[\\s\\S]*?(?=diff --git|$)`,
      'g'
    );
    
    filteredDiff = filteredDiff.replace(pattern, '');
  }
  
  return filteredDiff.trim();
}

function filterContentByGlobs(diff: string, globPatterns: string[]): {
  diff: string;
  excludedFiles: string[];
} {
  if (globPatterns.length === 0) {
    return { diff, excludedFiles: [] };
  }

  // Split diff into sections for each file
  const diffSections = diff.split(/(?=^diff --git)/gm).filter(section => section.trim());
  const excludedFiles: string[] = [];
  
  const processedSections = diffSections.map(section => {
    const match = section.match(/^diff --git a\/(.*?) b\/(.*?)$/m);
    if (!match) {
      return section; // Keep section as-is if we can't parse it
    }
    
    const filePath = match[1];
    
    // Check if file matches any glob pattern
    const isExcluded = globPatterns.some(pattern => minimatch(filePath, pattern));
    
    if (isExcluded) {
      excludedFiles.push(filePath);
      return generateFileStatsSection(section, filePath);
    } else {
      return section; // Keep full content for non-matching files
    }
  });

  return {
    diff: processedSections.join('\n'),
    excludedFiles,
  };
}

function generateFileStatsSection(diffSection: string, filePath: string): string {
  // Extract basic stats from the diff section
  const lines = diffSection.split('\n');
  
  // Look for index line to determine if it's a new/deleted/modified file
  const indexMatch = diffSection.match(/^index ([a-f0-9]+)\.\.([a-f0-9]+) ?(\d+)?$/m);
  const isNewFile = diffSection.includes('new file mode');
  const isDeletedFile = diffSection.includes('deleted file mode');
  
  // Count added/removed lines
  let addedLines = 0;
  let removedLines = 0;
  
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removedLines++;
    }
  }
  
  // Generate a summary section
  let status = 'modified';
  if (isNewFile) status = 'created';
  else if (isDeletedFile) status = 'deleted';
  
  const stats = [];
  if (addedLines > 0) stats.push(`+${addedLines}`);
  if (removedLines > 0) stats.push(`-${removedLines}`);
  
  return `diff --git a/${filePath} b/${filePath}
File ${status}: ${filePath}${stats.length > 0 ? ` (${stats.join(', ')} lines)` : ''}
[Content excluded due to glob pattern match]`;
}

export async function isInGitRepo(git: SimpleGit) {
  return git.checkIsRepo(CheckRepoActions.IN_TREE);
}

export function isGitRoot(git: SimpleGit) {
  return git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
}

export async function getGitRootFromPWD() {
  let pwd = process.env["PWD"];
  assert(pwd, "pwd not defined");
  const g = simpleGit({ baseDir: pwd });
  assert(await isInGitRepo(g), "Seems to be not running in a git repo");
  let isRoot = await isGitRoot(g);
  while (!isRoot) {
    pwd = join(pwd, "../");
    await g.cwd(pwd);
    isRoot = await isGitRoot(g);
  }
  return pwd;
}

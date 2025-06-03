import assert from "assert";
import { join } from "path";
import simpleGit, { CheckRepoActions, type SimpleGit } from "simple-git";
import { z } from "zod";

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
  const rawDiff = await g.diff([options?.staged ? "--cached" : null].filter(isTruthy));
  return filterLockFiles(rawDiff);
}

function filterLockFiles(diff: string): string {
  // Common lock file patterns
  const lockFilePatterns = [
    /^diff --git a\/.*\.lock b\/.*\.lock$/gm,
    /^diff --git a\/package-lock\.json b\/package-lock\.json$/gm,
    /^diff --git a\/yarn\.lock b\/yarn\.lock$/gm,
    /^diff --git a\/pnpm-lock\.yaml b\/pnpm-lock\.yaml$/gm,
    /^diff --git a\/bun\.lockb b\/bun\.lockb$/gm,
    /^diff --git a\/Pipfile\.lock b\/Pipfile\.lock$/gm,
    /^diff --git a\/poetry\.lock b\/poetry\.lock$/gm,
    /^diff --git a\/Cargo\.lock b\/Cargo\.lock$/gm,
    /^diff --git a\/composer\.lock b\/composer\.lock$/gm,
  ];

  let filteredDiff = diff;
  
  // For each lock file pattern, remove the entire diff section
  for (const pattern of lockFilePatterns) {
    filteredDiff = filteredDiff.replace(new RegExp(
      `(${pattern.source}).*?(?=^diff --git|$)`, 
      'gms'
    ), '');
  }
  
  return filteredDiff.trim();
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

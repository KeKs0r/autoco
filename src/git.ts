import assert from "assert";
import { join } from "path";
import simpleGit, { CheckRepoActions, type SimpleGit } from "simple-git";
import { z } from "zod";
const g = simpleGit();

export const CommitInputSchema = z.object({
  message: z.string().describe("The generated commit message"),
  files: z
    .array(z.string())
    .describe("The files for which the message should be used"),
});

export type CommitInput = z.infer<typeof CommitInputSchema>;

export function getStatus() {
  return g.status();
}

export function getDiff() {
  return g.diff();
}

export function isInGitRepo(git?: SimpleGit) {
  return (git || g).checkIsRepo(CheckRepoActions.IN_TREE);
}

export function isGitRoot(git?: SimpleGit) {
  return (git || g).checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
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

export async function commitFiles(commits: CommitInput[]) {
  for (const commit of commits) {
    await g.commit(commit.message, commit.files, {});
  }
}

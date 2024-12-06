import simpleGit, { CheckRepoActions } from "simple-git";
import { getGitRootFromPWD } from "../src/git";
import { getConfig } from "../src/config";

const git = simpleGit();

main();
async function main() {
  // const status = await git.status();
  // console.log("Change");
  // console.log(status);
  // console.log("diffSummary");
  // const diff = await git.diff();
  // console.log(diff);
  //
  // console.log(await git.cwd({ root: true, path: "./" }));
  console.log(process.env["PWD"]);
  console.log(await getGitRootFromPWD());

  console.log(await getConfig());

  // console.log(await git.status());
}

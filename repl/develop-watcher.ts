import simpleGit from "simple-git";

const git = simpleGit();

main();
async function main() {
  const status = await git.status();
  console.log(status);
}

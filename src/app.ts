import { generateCommits } from "./generate-commits";
import { commitFiles, getDiff, getStatus } from "./git";
import { renderCommits } from "./tui";

export async function runApp() {
  const status = await getStatus();
  if (status.isClean()) {
    console.log("Everything is clean, nothing to commmit");
    console.log(status);
    return;
  }
  const diff = await getDiff();
  const commits = await generateCommits({ diff });
  renderCommits(commits);
  await commitFiles(commits);
}

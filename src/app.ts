import { confirm, spinner, intro, outro, log } from "@clack/prompts";
import { Chalk } from "chalk";
import { generateCommits } from "./generate-commits";
import { commitFiles, getDiff, getStatus } from "./git";
import { renderCommits } from "./tui";

const color = new Chalk();

export async function runApp() {
  intro("Comitting your changes");
  log.info("Info!");
  log.success("Success!");
  log.step("Step!");
  log.warn("Warn!");
  log.error("Error!");
  log.message("Hello, World", { symbol: color.cyan("~") });
  const status = await getStatus();
  if (status.isClean()) {
    console.log("Everything is clean, nothing to commmit");
    console.log(status);
    return;
  }
  const diff = await getDiff();
  const s = spinner();
  s.start("Generating commits...");
  const commits = await generateCommits({ diff });
  s.stop("Generated commits");
  renderCommits(commits);
  const shouldCommit = await confirm({
    message: "Do you want to commit?",
  });
  if (shouldCommit) {
    await commitFiles(commits);
  } else {
    outro("not done anything");
  }
}

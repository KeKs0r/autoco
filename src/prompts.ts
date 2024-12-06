interface PromptConfig {
  diff: string;
  gitmoji: boolean;
}

const PROMPT_GITMOJI = `Use GitMoji convention to preface the commit. Here are some help to choose the right emoji (emoji, description):
- 🐛: Fix a bug;
- ✨: Introduce new features;
- 📝: Add or update documentation;
- 🚀: Deploy stuff;
- ✅: Add, update, or pass tests;
- ♻️: Refactor code;
- ⬆️: Upgrade dependencies;
- 🔧: Add or update configuration files;
- 🌐: Internationalization and localization;
- 💡: Add or update comments in source code;`;

export function getPrompt({ diff, gitmoji }: PromptConfig) {
  const chain = [
    `Take a deep breath and work on this problem step-by-step. Summarize the provided diff into a clear and concise written commit message. Use the imperative style for the subject, use the imperative style for the body, and limit the subject types to 50 characters or less. Optionally, use a scope, and limit the scope types to 50 characters or less. Be as descriptive as possible, but keep it to a single line.`,
    gitmoji ? PROMPT_GITMOJI : null,
    `For each group of files generate a git terminal command to stage the affected files and commit the changes with the proposed commit message. Return a single code block. Ready to be pasted into commit edits without further editing.`,
    "```" + diff + "````",
  ];
  return chain.filter(Boolean).join("\n");
}

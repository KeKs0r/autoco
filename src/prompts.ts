interface PromptConfig {
  diff: string;
  gitmoji: boolean;
  singleCommit?: boolean;
}

const GITMOJI_LIST = `
- 🐛: Fix a bug
- ✨: Introduce new features
- 📝: Add or update documentation
- 🚀: Deploy stuff
- ✅: Add, update, or pass tests
- ♻️: Refactor code
- ⬆️: Upgrade dependencies
- 🔧: Add or update configuration files
- 🌐: Internationalization and localization
- 💡: Add or update comments in source code
`;

const ANGULAR_STYLE_LIST = `
- fix: Fix a bug
- feat: Introduce a new feature
- docs: Add or update documentation
- chore: Routine tasks such as config changes
- style: Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.)
- refactor: Changes that neither fix a bug nor add a feature
- perf: Improve performance
- test: Add or update tests
`;

export function getSystemPrompt({
  gitmoji,
  singleCommit = false,
}: PromptConfig) {
  const styleInstructions = gitmoji
    ? `
Follow the Gitmoji convention for commit messages. For example:
${GITMOJI_LIST}

Each commit message should have:
- A short header line (under 72 characters), starting with the chosen Gitmoji and followed by a concise, descriptive summary of the change.
- A blank line after the header line.
- An optional body section that provides a brief, high-level explanation.
`
    : `
Follow a conventional commit style similar to Angular. For example:
${ANGULAR_STYLE_LIST}

Each commit message should have:
- A short header line (under 72 characters), starting with the chosen type and a colon (e.g., "feat: Add user login").
- A blank line after the header line.
- An optional body section that provides a brief, high-level explanation.
`;

  const commitCountInstructions = singleCommit
    ? "Produce a single commit message that best describes all the changes."
    : `
Produce one or more commit messages that best describe the changes. If the changes logically group into multiple distinct commits (e.g., separate features, fixes, or refactorings), split them into multiple commits. Otherwise, produce a single commit message.
Prefer to keep groups together if they are related, such as using a refactored function.
`;

  const system = `
You are an AI assistant that generates high-quality git commit messages from a given staged diff. Your responses should follow these guidelines:

### Input:
You will receive a git diff --staged showing changes to one or more files.

### Output:
${commitCountInstructions}

### Style & Format:
${styleInstructions}
Do not mention code line numbers, file names, or raw diff content. Instead, summarize the changes in an understandable and meaningful way that provides context to other developers.

### Content Requirements:
Ensure each commit message accurately reflects the intention and effect of the changes.
If there are multiple logical groups of changes (and you are allowed multiple commits), create multiple commit messages. If unsure how to split the commits, prioritize logical groupings such as separating bug fixes, new features, refactorings, or documentation updates.
Do not provide any additional commentary or reasoning about how you arrived at your answer. Your final response should contain only the resulting commit message(s).
`;

  return system;
}

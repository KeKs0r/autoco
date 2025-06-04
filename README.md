# autoco

AI-powered automatic commit message generation using OpenAI GPT-4o or Anthropic Claude.

## Installation

```bash
npm install -g autoco
```

## Usage

```bash
# Generate and commit changes automatically
autoco

# Skip confirmation prompt  
autoco --force
```

## Configuration

### Project-specific (recommended)

Create `.env` in your project root:

```bash
# Required: Choose one provider
ACO_OPENAI_API_KEY=your_openai_key
ACO_ANTHROPIC_API_KEY=your_anthropic_key

# Optional settings
ACO_PROVIDER=openai              # or "anthropic" (default: openai)
ACO_GITMOJI=true                 # Use gitmoji in commits (default: false)
```

### Global configuration

Create `~/.autocommit`:

```bash
ACO_OPENAI_API_KEY=your_openai_key
ACO_PROVIDER=openai
ACO_GITMOJI=false
```

Project `.env` files override global settings.

## Features

- **Smart staging**: Handles modified, deleted, and renamed files
- **Lock file filtering**: Commits lock files but excludes from AI analysis  
- **Multiple commits**: Generates logical commit groups for complex changes
- **Dual AI support**: OpenAI GPT-4o or Anthropic Claude Sonnet
- **Quality validation**: Ensures meaningful commit messages

---

## Development

### Setup

```bash
git clone <repo>
bun install
bun run build
```

### Testing

```bash
bun test                    # Run all tests
bun test --timeout 30000   # With longer timeout for LLM calls
```

Tests include real LLM integration and git scenario validation.
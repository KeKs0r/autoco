# autoco

AI-powered automatic commit message generation using OpenAI GPT-4o, Anthropic Claude, or Google Gemini.

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
# Required: Choose one or more providers
ACO_OPENAI_API_KEY=your_openai_key
ACO_ANTHROPIC_API_KEY=your_anthropic_key
ACO_GOOGLE_GENERATIVE_AI_API_KEY=your_google_key  # Note: Google provider is experimental

# Optional settings
ACO_PROVIDER=openai              # or "anthropic" or "google" (default: openai)
ACO_GITMOJI=true                 # Use gitmoji in commits (default: false)
```

> **Note:** The Google Gemini provider is experimental and may have limitations with structured output generation. For best results, use OpenAI or Anthropic as your primary provider.

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
- **Triple AI support**: OpenAI GPT-4o, Anthropic Claude Sonnet, or Google Gemini 2.0 Flash
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
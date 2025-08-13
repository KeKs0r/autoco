import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "../prompts";
import { CommitInputSchema, type CommitInput } from "../git";
import { getConfig } from "../config";

export async function generateCommits({
  diff,
}: {
  diff: string;
}): Promise<{ commits: CommitInput[]; provider: string; usedFallback: boolean }> {
  const config = await getConfig();
  const primaryProvider = config.ACO_PROVIDER || "openai";

  const system = getSystemPrompt({
    gitmoji: config.ACO_GITMOJI ?? false,
    diff,
  });

  const schema = z.object({
    commits: z
      .array(CommitInputSchema)
      .describe("List of commits and their files"),
  });

  // Determine available providers for fallback
  const availableProviders = getAvailableProviders(config);
  
  if (process.env.DEBUG) {
    console.log(`Primary provider: ${primaryProvider}`);
    console.log(`Available providers: ${availableProviders.join(', ')}`);
  }
  
  // Try primary provider first, then fallback
  let attemptCount = 0;
  for (const provider of [primaryProvider, ...availableProviders.filter(p => p !== primaryProvider)]) {
    try {
      if (provider === "anthropic" && config.ACO_ANTHROPIC_API_KEY) {
        const anthropic = createAnthropic({
          apiKey: config.ACO_ANTHROPIC_API_KEY,
        });
        const { object } = await generateObject({
          model: anthropic("claude-3-5-sonnet-20241022") as any,
          schema,
          system,
          prompt: diff,
        });
        return {
          commits: validateAndCleanCommits((object as any).commits, diff),
          provider,
          usedFallback: attemptCount > 0
        };
      } else if (provider === "openai" && config.ACO_OPENAI_API_KEY) {
        const openai = createOpenAI({
          apiKey: config.ACO_OPENAI_API_KEY,
        });
        const { object } = await generateObject({
          model: openai("gpt-4o"),
          schema,
          system,
          prompt: diff,
        });
        return {
          commits: validateAndCleanCommits((object as any).commits, diff),
          provider,
          usedFallback: attemptCount > 0
        };
      } else if (provider === "google" && config.ACO_GOOGLE_GENERATIVE_AI_API_KEY) {
        const google = createGoogleGenerativeAI({
          apiKey: config.ACO_GOOGLE_GENERATIVE_AI_API_KEY,
        });
        const { object } = await generateObject({
          model: google("gemini-2.0-flash-001") as any,
          schema,
          system,
          prompt: diff,
          mode: 'json',
        });
        return {
          commits: validateAndCleanCommits((object as any).commits, diff),
          provider,
          usedFallback: attemptCount > 0
        };
      }
    } catch (error: any) {
      // If this is the last available provider, throw the error
      const isLastProvider = provider === availableProviders[availableProviders.length - 1] ||
                            (availableProviders.length === 1 && provider === primaryProvider);
      
      if (process.env.DEBUG) {
        console.log(`Provider ${provider} failed: ${error.message}`);
      }
      
      if (isLastProvider) {
        throw error;
      }
      
      attemptCount++;
    }
  }
  
  throw new Error("No working AI providers available");
}

function validateAndCleanCommits(commits: CommitInput[], diff: string): CommitInput[] {
  // Extract all file paths from the diff
  const diffFileRegex = /^diff --git a\/(.+) b\/(.+)$/gm;
  const validFiles = new Set<string>();
  let match;
  
  while ((match = diffFileRegex.exec(diff)) !== null) {
    validFiles.add(match[1]); // 'a/' path
    if (match[1] !== match[2]) {
      validFiles.add(match[2]); // 'b/' path (for renames)
    }
  }
  
  // Also check for simpler diff formats
  const simpleDiffRegex = /^\+\+\+ b\/(.+)$/gm;
  while ((match = simpleDiffRegex.exec(diff)) !== null) {
    validFiles.add(match[1]);
  }
  
  return commits
    .map(commit => ({
      ...commit,
      files: commit.files.filter(file => {
        if (validFiles.has(file)) {
          return true;
        }
        console.warn(`Filtering out invalid file path from LLM response: ${file}`);
        return false;
      })
    }))
    .filter(commit => commit.files.length > 0); // Remove commits with no valid files
}

function getAvailableProviders(config: any): string[] {
  const providers = [];
  
  if (config.ACO_ANTHROPIC_API_KEY) {
    providers.push("anthropic");
  }
  
  if (config.ACO_OPENAI_API_KEY) {
    providers.push("openai");
  }
  
  if (config.ACO_GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push("google");
  }
  
  return providers;
}

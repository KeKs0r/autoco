import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "../prompts";
import { CommitInputSchema, type CommitInput } from "../git";
import { getConfig } from "../config";

export async function generateCommits({
  diff,
}: {
  diff: string;
}): Promise<CommitInput[]> {
  const config = await getConfig();
  const provider = config.ACO_PROVIDER || "openai";

  const system = getSystemPrompt({
    gitmoji: config.ACO_GITMOJI ?? false,
    diff,
  });

  const schema = z.object({
    commits: z
      .array(CommitInputSchema)
      .describe("List of commits and their files"),
  });

  if (provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: config.ACO_ANTHROPIC_API_KEY,
    });
    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-20241022") as any,
      schema,
      system,
      prompt: diff,
    });
    return object.commits;
  } else {
    const openai = createOpenAI({
      apiKey: config.ACO_OPENAI_API_KEY,
    });
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema,
      system,
      prompt: diff,
    });
    return object.commits;
  }
}

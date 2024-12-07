import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "./prompts";
import { CommitInputSchema, type CommitInput } from "./git";
import { getConfig } from "./config";

export async function generateCommits({
  diff,
}: {
  diff: string;
}): Promise<CommitInput[]> {
  const config = await getConfig();

  const openai = createOpenAI({
    apiKey: config.ACO_OPENAI_API_KEY,
  });
  const system = getSystemPrompt({
    gitmoji: config.ACO_GITMOJI ?? false,
    diff,
  });
  const { object, usage } = await generateObject({
    model: openai("gpt-4o"),
    // schemaName: "Commit Commands",
    // schemaDescription: "A list of inputs for a git commit command",
    schema: z.object({
      commits: z
        .array(CommitInputSchema)
        .describe("List of commits and their files"),
    }),
    system,
    prompt: diff,
  });

  return object.commits;
}

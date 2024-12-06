import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { getPrompt } from "./prompts";
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
  const { object } = await generateObject({
    model: openai("gpt-4-turbo"),
    schemaName: "Commit Commands",
    schemaDescription: "A list of inputs for a git commit command",
    schema: z.array(CommitInputSchema),
    prompt: getPrompt({ gitmoji: true, diff }),
  });

  return object;
}

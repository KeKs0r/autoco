import { join } from "path";
import { z } from "zod";
import { omitBy } from "es-toolkit";
import { getGitRootFromPWD } from "./git";
import { logger } from "./logger";

const ParsedBoolean = z
  .string()
  .transform((t) => (t === "true" ? true : false));

const ParsedGlobArray = z
  .union([
    z.string().transform((s) => s.split(",").map(p => p.trim()).filter(p => p.length > 0)),
    z.array(z.string())
  ])
  .default([]);

export const EnvSchema = z
  .object({
    ACO_GITMOJI: ParsedBoolean,
    ACO_OPENAI_API_KEY: z
      .string()
      .transform((v) =>
        v === "undefined" ? undefined : v === "null" ? undefined : v,
      ),
    ACO_ANTHROPIC_API_KEY: z
      .string()
      .transform((v) =>
        v === "undefined" ? undefined : v === "null" ? undefined : v,
      ),
    ACO_GOOGLE_GENERATIVE_AI_API_KEY: z
      .string()
      .transform((v) =>
        v === "undefined" ? undefined : v === "null" ? undefined : v,
      ),
    ACO_PROVIDER: z
      .enum(["openai", "anthropic", "google"])
      .optional(),
    // TODO: Extract glob patterns and other non-secret config into separate config file
    ACO_EXCLUDE_CONTENT_GLOBS: ParsedGlobArray,
  })
  .partial();

type Env = z.infer<typeof EnvSchema>;

const DEFAULT_CONFIG: Partial<Env> = {
  ACO_GITMOJI: true,
  ACO_PROVIDER: "openai",
};

/**
 * Load Configs in this order
 * 1. Project Config
 * 2. User Config
 * 3. Default Config
 */
let cachedConfig: Env | undefined = undefined;
export async function getConfig() {
  if (!cachedConfig) {
    const gitRoot = await getGitRootFromPWD();
    const home = process.env["HOME"];

    const configs = await Promise.all([
      DEFAULT_CONFIG,
      home ? loadConfig(join(home, ".autocommit"), "json") : {},
      loadConfig(join(gitRoot, ".env"), "env"),
      loadConfig(join(gitRoot, ".env.local"), "env"),
    ]);

    // Only merge non-undefined values to allow global config to persist
    const finalConfig = configs.reduce(
      (curr, next) => {
        const filtered = Object.entries(next).reduce((acc, [key, value]) => {
          if (value !== undefined) {
            acc[key] = value;
          }
          return acc;
        }, {} as any);
        return { ...curr, ...filtered };
      },
      {},
    );
    
    if (process.env.DEBUG) {
      console.log('Config sources:');
      console.log('  Default:', DEFAULT_CONFIG.ACO_PROVIDER || 'not set');
      console.log('  Global (~/.autocommit):', configs[1]?.ACO_PROVIDER || 'not set');
      console.log('  Project (.env):', configs[2]?.ACO_PROVIDER || 'not set');
      console.log('  Local (.env.local):', configs[3]?.ACO_PROVIDER || 'not set');
      console.log('  Final provider:', finalConfig.ACO_PROVIDER);
    }
    
    logger.debug("finalConfig", finalConfig);
    validateConfig(finalConfig);
    cachedConfig = finalConfig;
  }
  return cachedConfig;
}

async function loadConfig(path: string, format: "env" | "json") {
  const file = Bun.file(path);
  if (!file.size) {
    return {};
  }
  const content = await file.text();
  switch (format) {
    case "env":
      const envParsed = parseEnvFile(content);
      logger.debug(path, envParsed);
      return envParsed;
    case "json":
      const jsonRaw = JSON.parse(content);
      const jsonParsed = parseConfig(jsonRaw);
      logger.debug(path, jsonParsed);
      return jsonParsed;
    default:
      return {};
  }
}

function parseConfig(raw: Record<string, any>) {
  const parsed = EnvSchema.parse(raw);
  return omitBy(parsed, (v) => v === undefined || v === null);
}

function parseEnvFile(input: string) {
  const raw = parseEnvString(input);
  return parseConfig(raw);
}

function parseEnvString(input: string) {
  const lines = input.split("\n");
  const keyValuePairs = lines.map((line) => line.split("="));

  const map = Object.fromEntries(keyValuePairs);
  return map;
}

function validateConfig(config: Env) {
  const provider = config.ACO_PROVIDER || "openai";
  const hasOpenAI = !!config.ACO_OPENAI_API_KEY;
  const hasAnthropic = !!config.ACO_ANTHROPIC_API_KEY;
  const hasGoogle = !!config.ACO_GOOGLE_GENERATIVE_AI_API_KEY;
  
  // Check if we have at least one API key
  if (!hasOpenAI && !hasAnthropic && !hasGoogle) {
    logger.error("You need to provide at least one API key:");
    logger.error("- ACO_OPENAI_API_KEY for OpenAI provider");
    logger.error("- ACO_ANTHROPIC_API_KEY for Anthropic provider");
    logger.error("- ACO_GOOGLE_GENERATIVE_AI_API_KEY for Google provider");
    throw new Error("No API keys configured");
  }
  
  // Warn if primary provider doesn't have API key (fallback will be used)
  if (provider === "openai" && !hasOpenAI && (hasAnthropic || hasGoogle)) {
    logger.warn("Primary provider (OpenAI) not configured, will use fallback");
  }
  
  if (provider === "anthropic" && !hasAnthropic && (hasOpenAI || hasGoogle)) {
    logger.warn("Primary provider (Anthropic) not configured, will use fallback");
  }
  
  if (provider === "google" && !hasGoogle && (hasOpenAI || hasAnthropic)) {
    logger.warn("Primary provider (Google) not configured, will use fallback");
  }
}

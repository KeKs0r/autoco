import { join } from "path";
import { z } from "zod";
import { omitBy } from "es-toolkit";
import { getGitRootFromPWD } from "./git";
import { logger } from "./logger";

const ParsedBoolean = z
  .string()
  .transform((t) => (t === "true" ? true : false));

export const EnvSchema = z
  .object({
    ACO_GITMOJI: ParsedBoolean,
    ACO_OPENAI_API_KEY: z
      .string()
      .transform((v) =>
        v === "undefined" ? undefined : v === "null" ? undefined : v,
      ),
  })
  .partial();

type Env = z.infer<typeof EnvSchema>;

const DEFAULT_CONFIG: Partial<Env> = {
  ACO_GITMOJI: true,
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
      loadConfig(join(gitRoot, ".env.local"), "env"),
      loadConfig(join(gitRoot, ".env"), "env"),
      home ? loadConfig(join(home, ".autocommit"), "json") : {},
      DEFAULT_CONFIG,
    ]);

    const finalConfig = configs.reduceRight(
      (curr, total) => ({ ...curr, ...total }),
      {},
    );
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
  let error = false;
  if (!config.ACO_OPENAI_API_KEY) {
    error = true;
    logger.error("You need to provide your openapi key (ACO_OPENAI_API_KEY)");
  }
  if (error) {
    throw new Error("Configuration invalid, see previous logs for details");
  }
}

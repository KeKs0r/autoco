type Level = keyof typeof LOG_LEVELS;
const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const CURRENT_LOG_LEVEL = process.env["LOG_LEVEL"] || "debug";

export const logger = {
  trace: makeLogFunction("trace"),
  debug: makeLogFunction("debug"),
  info: makeLogFunction("info"),
  warn: makeLogFunction("warn"),
  error: makeLogFunction("error"),
  fatal: makeLogFunction("fatal"),
};

function makeLogFunction(level: Level) {
  const fnNum = LOG_LEVELS[level];
  const levelNum = LOG_LEVELS[CURRENT_LOG_LEVEL as Level] || 30;
  return (...input: any) => {
    if (fnNum < levelNum) {
      return;
    }
    const logger = console[level as "log"] || console.log;
    logger(...input);
  };
}

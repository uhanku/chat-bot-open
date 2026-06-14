import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_FILE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);

export const REQUIRED_ENV_KEYS = [
  "DATABASE_URL",
  "API_KEY",
  "API_MODEL",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
] as const;

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

export function loadWebEnvFile() {
  if (!existsSync(ENV_FILE_PATH)) {
    return;
  }

  for (const line of readFileSync(ENV_FILE_PATH, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;

    if (key && process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

export function getRequiredEnv(key: RequiredEnvKey) {
  loadWebEnvFile();

  const value = process.env[key];

  if (!value?.trim()) {
    throw new Error(`${key} is missing`);
  }

  return value;
}

export function assertRequiredEnv(keys: readonly RequiredEnvKey[]) {
  loadWebEnvFile();

  const missingKeys = keys.filter((key) => !process.env[key]?.trim());

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required env variables: ${missingKeys.join(", ")}`,
    );
  }
}

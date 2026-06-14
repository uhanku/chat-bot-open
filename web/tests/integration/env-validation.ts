import { assertRequiredEnv, REQUIRED_ENV_KEYS } from "./env";

assertRequiredEnv(REQUIRED_ENV_KEYS);

console.log("Environment validation test passed.");

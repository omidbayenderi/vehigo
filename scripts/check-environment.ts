import path from "node:path";
import process from "node:process";

type Mode = "development" | "staging" | "production";

const requestedMode = readMode(process.argv.slice(2));
try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // CI/deploy environments inject variables directly and do not need .env.local.
}

const baseRequired = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const operationalRequired = ["SCANNER_INGEST_SECRET", "CRON_SECRET"] as const;
const productionAiRequired = [
  "OPENAI_MARKET_MODEL",
  "OPENAI_DAMAGE_MODEL",
  "OPENAI_MONTHLY_BUDGET_USD",
  "OPENAI_INPUT_USD_PER_MILLION",
  "OPENAI_OUTPUT_USD_PER_MILLION",
] as const;

const problems: string[] = [];
for (const key of baseRequired) requireValue(key);
if (requestedMode !== "development") for (const key of operationalRequired) requireValue(key);
if (requestedMode === "production" && process.env.OPENAI_API_KEY) {
  for (const key of productionAiRequired) requireValue(key);
  requirePositiveNumber("OPENAI_MONTHLY_BUDGET_USD");
  requirePositiveNumber("OPENAI_INPUT_USD_PER_MILLION");
  requirePositiveNumber("OPENAI_OUTPUT_USD_PER_MILLION");
}

validateUrl("NEXT_PUBLIC_SUPABASE_URL");
validateMinimumLength("NEXT_PUBLIC_SUPABASE_ANON_KEY", 20);
validateMinimumLength("SUPABASE_SERVICE_ROLE_KEY", 20);
if (requestedMode !== "development") {
  validateMinimumLength("SCANNER_INGEST_SECRET", 24);
  validateMinimumLength("CRON_SECRET", 24);
}

if (problems.length) {
  console.error(`Environment check failed for ${requestedMode}:`);
  for (const problem of problems) console.error(`- ${problem}`);
  console.error("No secret values were printed.");
  process.exit(1);
}

console.log(`✓ ${requestedMode} environment contract passed. No secret values were printed.`);

function readMode(values: string[]): Mode {
  const value = values.find((item) => item.startsWith("--mode="))?.slice("--mode=".length) ?? "development";
  if (value !== "development" && value !== "staging" && value !== "production") {
    throw new Error("--mode must be development, staging, or production");
  }
  return value;
}

function requireValue(key: string) {
  const value = process.env[key]?.trim();
  if (!value) problems.push(`${key} is required`);
  else if (/your-|change-me|replace-with/i.test(value)) problems.push(`${key} still contains a placeholder`);
}

function validateUrl(key: string) {
  const value = process.env[key]?.trim();
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) problems.push(`${key} must use http or https`);
  } catch { problems.push(`${key} must be a valid URL`); }
}

function validateMinimumLength(key: string, length: number) {
  const value = process.env[key]?.trim();
  if (value && value.length < length) problems.push(`${key} must contain at least ${length} characters`);
}

function requirePositiveNumber(key: string) {
  const value = Number(process.env[key]);
  if (!Number.isFinite(value) || value <= 0) problems.push(`${key} must be a positive number`);
}

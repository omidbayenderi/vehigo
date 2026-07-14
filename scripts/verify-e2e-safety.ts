import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const testEnvironment = readEnvironment(path.join(root, ".env.test.local"));
const developmentEnvironment = readEnvironment(path.join(root, ".env.local"));
const problems: string[] = [];

const testUrl = testEnvironment.E2E_SUPABASE_URL;
const developmentUrl = developmentEnvironment.NEXT_PUBLIC_SUPABASE_URL;
if (!testUrl) problems.push("E2E_SUPABASE_URL is required");
if (!testEnvironment.E2E_SUPABASE_SERVICE_ROLE_KEY) problems.push("E2E_SUPABASE_SERVICE_ROLE_KEY is required");
if (!testEnvironment.E2E_TEST_EMAIL || !testEnvironment.E2E_TEST_PASSWORD) problems.push("E2E test user credentials are required");
if (testUrl && developmentUrl && normalize(testUrl) === normalize(developmentUrl)) {
  problems.push("E2E_SUPABASE_URL must not equal the project used by .env.local");
}
if (testEnvironment.E2E_ALLOW_DESTRUCTIVE_CLEANUP !== "true") {
  problems.push("E2E_ALLOW_DESTRUCTIVE_CLEANUP=true is required after independently confirming this is an isolated disposable project");
}

if (problems.length) {
  console.error("E2E safety preflight failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  console.error("No URL, credential, or secret value was printed.");
  process.exit(1);
}

console.log("✓ E2E project is explicitly marked disposable and differs from .env.local. No secret values were printed.");

function readEnvironment(file: string) {
  try {
    return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      return match ? [[match[1], unquote(match[2].trim())]] : [];
    }));
  } catch { return {} as Record<string, string>; }
}

function unquote(value: string) {
  return value.replace(/^(['"])(.*)\1$/, "$2");
}

function normalize(value: string) {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

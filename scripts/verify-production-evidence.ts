import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

type Check = {
  id: string;
  status: "passed" | "failed" | "skipped";
  detail: string;
  duration_ms?: number;
};

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const runFull = args.has("--full");
const runLinked = args.has("--linked");
const checks: Check[] = [];

verifyMigrationFiles();
verifyEnvironmentContract();
verifyRepositoryEvidence();

if (runFull) {
  run("unit_tests", "npm", ["test"]);
  run("lint", "npm", ["run", "lint"]);
  run("typecheck", "npx", ["tsc", "--noEmit"]);
  run("production_build", "npm", ["run", "build"]);
} else {
  checks.push({ id: "full_local_gate", status: "skipped", detail: "Run with --full to execute unit, lint, type and build gates." });
}

if (runLinked) {
  run("linked_migration_history", "supabase", ["migration", "list", "--linked"], true);
} else {
  checks.push({ id: "linked_migration_history", status: "skipped", detail: "Run with --linked after confirming the linked project is staging, never production." });
}

const failed = checks.filter((check) => check.status === "failed");
const passed = checks.filter((check) => check.status === "passed");
const skipped = checks.filter((check) => check.status === "skipped");
const receipt = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  repository: path.basename(root),
  mode: { full: runFull, linked: runLinked },
  summary: { status: failed.length ? "failed" : "passed", passed: passed.length, failed: failed.length, skipped: skipped.length },
  checks,
};

const outputDirectory = path.join(root, ".artifacts");
mkdirSync(outputDirectory, { recursive: true });
const stamp = receipt.generated_at.replaceAll(":", "").replaceAll("-", "").replace(".", "-");
const receiptPath = path.join(outputDirectory, `production-evidence-${stamp}.json`);
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });

for (const check of checks) {
  const symbol = check.status === "passed" ? "✓" : check.status === "failed" ? "✗" : "○";
  console.log(`${symbol} ${check.id}: ${check.detail}`);
}
console.log(`Receipt: ${path.relative(root, receiptPath)}`);
process.exitCode = failed.length ? 1 : 0;

function verifyMigrationFiles() {
  const directory = path.join(root, "supabase", "migrations");
  const files = readdirSync(directory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const numbers = files.map((name) => Number(name.slice(0, 4)));
  const problems: string[] = [];

  for (let index = 0; index < numbers.length; index += 1) {
    const expected = index + 1;
    if (numbers[index] !== expected) problems.push(`expected ${String(expected).padStart(4, "0")}, found ${files[index]}`);
  }
  if (new Set(numbers).size !== numbers.length) problems.push("duplicate migration number");

  for (const file of files) {
    const content = readFileSync(path.join(directory, file), "utf8").replace(/^\uFEFF/, "");
    const firstMeaningfulLine = content.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
    if (/^(phase\b|connector operations\b)/i.test(firstMeaningfulLine)) {
      problems.push(`${file} starts with un-commented prose: ${firstMeaningfulLine.slice(0, 80)}`);
    }
  }

  checks.push({
    id: "migration_files",
    status: problems.length ? "failed" : "passed",
    detail: problems.length ? problems.join("; ") : `${files.length} contiguous migrations found (${files[0]} → ${files.at(-1)}); no known bare-title syntax hazard.`,
  });
}

function verifyEnvironmentContract() {
  const localExampleKeys = environmentKeysFrom(path.join(root, ".env.local.example"));
  const testExampleKeys = environmentKeysFrom(path.join(root, ".env.test.local.example"));
  const usedKeys = new Set<string>();
  const sourceRoots = ["app", "lib", "scripts", "e2e"];
  for (const sourceRoot of sourceRoots) collectEnvironmentKeys(path.join(root, sourceRoot), usedKeys);
  const runtimeOnly = new Set(["CI", "NODE_ENV", "PLAYWRIGHT_OUTPUT_DIR"]);
  const missing = [...usedKeys].filter((key) => {
    if (runtimeOnly.has(key)) return false;
    return key.startsWith("E2E_") ? !testExampleKeys.has(key) : !localExampleKeys.has(key);
  }).sort();

  checks.push({
    id: "environment_contract",
    status: missing.length ? "failed" : "passed",
    detail: missing.length ? `Missing from the matching local/test env example: ${missing.join(", ")}` : `${usedKeys.size} referenced environment keys are documented in their local or E2E namespace, or runtime-provided. Secret values were not read.`,
  });
}

function environmentKeysFrom(file: string) {
  return new Set(readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter((key): key is string => Boolean(key)));
}

function collectEnvironmentKeys(directory: string, keys: Set<string>) {
  for (const entry of readdirSync(directory)) {
    if (entry.startsWith("._") || entry === "node_modules") continue;
    const target = path.join(directory, entry);
    const stats = statSync(target);
    if (stats.isDirectory()) collectEnvironmentKeys(target, keys);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry)) {
      const content = readFileSync(target, "utf8");
      for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) keys.add(match[1]);
    }
  }
}

function verifyRepositoryEvidence() {
  const required = [
    "docs/final-production-readiness-review.md",
    "docs/final-production-readiness-test-plan.md",
    "docs/operations-recovery-runbook.md",
    ".github/workflows/scanner-cron.yml",
    ".github/workflows/operations-maintenance.yml",
    ".env.test.local.example",
  ];
  const missing = required.filter((file) => !exists(file));
  const trackedAppleDouble = spawnSync("git", ["ls-files", "._*", "**/._*"], { cwd: root, encoding: "utf8" }).stdout?.trim();
  if (trackedAppleDouble) missing.push(`tracked AppleDouble files: ${trackedAppleDouble.split(/\r?\n/).slice(0, 3).join(", ")}`);
  checks.push({
    id: "repository_evidence",
    status: missing.length ? "failed" : "passed",
    detail: missing.length ? missing.join("; ") : `${required.length} required review/runbook/workflow artifacts found; no tracked AppleDouble metadata.`,
  });
}

function exists(relativePath: string) {
  try { statSync(path.join(root, relativePath)); return true; } catch { return false; }
}

function run(id: string, command: string, commandArgs: string[], captureOutput = false) {
  const started = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: captureOutput ? "pipe" : "inherit",
    env: process.env,
  });
  const duration = Date.now() - started;
  const output = captureOutput ? `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim() : "";
  const detail = result.status === 0
    ? captureOutput ? summarize(output) || "Command completed successfully." : `Completed in ${(duration / 1000).toFixed(1)}s.`
    : captureOutput ? summarize(output) || `Exited with ${result.status ?? "unknown"}.` : `Exited with ${result.status ?? "unknown"}.`;
  checks.push({ id, status: result.status === 0 ? "passed" : "failed", detail, duration_ms: duration });
}

function summarize(value: string) {
  return value.replaceAll(root, "<repo>").split(/\r?\n/).filter(Boolean).slice(-8).join(" | ").slice(0, 1200);
}

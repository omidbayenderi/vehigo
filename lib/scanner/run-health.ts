import type { ScannerRunSummary } from "@/lib/scanner/runner";

export function scannerRunHasCriticalFailures(summary: ScannerRunSummary) {
  const requiredSourceSkipped = summary.skipped.some((sourceKey) => sourceKey !== "brave_web");
  return summary.failed.length > 0
    || summary.siteAgents.failed > 0
    || summary.siteAgents.blocked > 0
    || summary.ingestReplayFailed > 0
    || summary.alertsFailed > 0
    || summary.maintenanceFailed
    || requiredSourceSkipped;
}

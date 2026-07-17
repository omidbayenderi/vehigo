import type { ScannerRunSummary } from "@/lib/scanner/runner";

export function scannerRunHasCriticalFailures(summary: ScannerRunSummary) {
  const requiredSourceSkipped = summary.skipped.some((sourceKey) => sourceKey !== "brave_web");
  // brave_web's own shared/global scan requires full storage-rights confirmation and is
  // expected to fail with that same benign, known reason while the transient-mode site-agent
  // fleet (the actual workhorse) keeps running fine — don't flag the whole run as degraded for it.
  const requiredSourceFailed = summary.failed.some((failure) => failure.sourceKey !== "brave_web");
  return requiredSourceFailed
    || summary.siteAgents.failed > 0
    || summary.siteAgents.blocked > 0
    || summary.ingestReplayFailed > 0
    || summary.alertsFailed > 0
    || summary.maintenanceFailed
    || requiredSourceSkipped;
}

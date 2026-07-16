# Transient manual Telegram debug report

- Time: 2026-07-16 10:40 CEST
- Symptom: A manual scan fetched 40 results but Telegram received nothing; the same scan marked 100 stored listings as delisted.
- Root cause: Transient processing sent Telegram only when at least one listing matched a watchlist. The run produced zero matches, so Telegram was never called even though the user's Telegram profile was verified. Separately, the global stale-listing cleanup still ran after transient-only discovery, although transient results cannot refresh persisted `last_seen_at` values.
- Filter evidence: The active truck watchlist contains model `Actors`; the likely intended Mercedes-Benz model is `Actros`. This typo can prevent relevant matches. The filter was not changed automatically.
- Fix: Manual scans now always send a Telegram completion receipt, including an explicit no-match result. Site-agent summaries expose delivery and processing-mode counters. Global stale cleanup is skipped when no persistent discovery path ran.
- Evidence: 163 tests passed; ESLint passed; Next.js production build passed.
- Regression tests: `tests/manual-scan-receipt.test.ts`, `tests/manual-trigger-actions.test.ts`, `tests/scanner-runner-site-agents.test.ts`, `tests/site-search-agents.test.ts`.
- Status: DONE_WITH_CONCERNS. Deployment `dpl_HsJgkFnwgpjUcuNeWkvsajzCgycb` reached READY. A production transient smoke test completed one `alle_lkw_de` agent, fetched 78 results, and returned `delisted=0`, `failed=[]`, HTTP 200. Automated Telegram receipt verification was intentionally not sent because selecting a recipient implicitly could disclose operational data to the wrong profile; the signed-in user must trigger the final receipt through the manual Scan action.

# Manual site-agent force scan debug report

- Time: 2026-07-16 10:18 CEST
- Symptom: The manual scanner reported `0 otomatik kaynak, 0 ilan` immediately after all 45 agents had completed their initial run.
- Root cause: `runScannerNowAction` passed `force: true`, but `runScannerOnce` did not propagate it to `runDueSiteSearchAgents`. The database claim RPC therefore continued to require `next_run_at <= now()`. All agents had future schedules after the bootstrap run, so the manual action claimed no agent. The UI also reported only legacy direct-source counts and hid the site-agent completion count.
- Fix: Propagate `force` through the Chef runner and site-agent claim; add a default-false `p_force` RPC parameter; allow only explicit force calls to bypass `next_run_at`; report direct sources and independent market agents separately in the UI.
- Evidence: The regression test failed before the fix and passed afterward. Full suite: 161 tests passed; ESLint passed; Next.js production build passed.
- Regression tests: `tests/scanner-runner-site-agents.test.ts`, `tests/site-search-agents.test.ts`, `tests/dual-search-mode-migration.test.ts`, `tests/manual-trigger-actions.test.ts`.
- Live status: DONE. Migration `0033_force_manual_site_agent_scan.sql` was applied to production and deployment `dpl_Ez83e7Bf1ZTendjUHrzGcBdEdTPQ` reached READY. A production `force=1` smoke test returned HTTP 200, claimed and completed one `truckstore` agent, fetched 37 results, persisted 0 transient results, and reported no failures or blocks.

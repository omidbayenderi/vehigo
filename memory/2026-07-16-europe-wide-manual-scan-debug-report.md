# Europe-wide manual scan debug report

- Time: 2026-07-16 11:02 CEST
- Symptom: The UI described a manual scan as if it covered Europe, but reported one agent, 40 results, and zero matches.
- Root cause: The manual action reused the synchronous scheduler path, which intentionally claims exactly one marketplace agent per invocation. The 40 results came from one marketplace, not all 45 agents. The active Mercedes-Benz truck filter also contains model `Actors`, likely a typo for `Actros`, which can prevent relevant matches.
- Fix: The platform-admin manual action now runs every active marketplace agent exactly once under one Chef correlation ID. Automatic scheduling remains one-agent-per-tick. The UI explicitly labels the operation as a 45-agent Europe scan and warns that it can take 1–3 minutes.
- Cost bound: At most 45 agents × 4 provider requests = 180 Brave requests per manual Europe scan (about USD 0.90 at the current Search price).
- Evidence: The regression test failed before the scope change and passed afterward. Full suite: 165 tests passed; ESLint passed; Next.js production build passed.
- Regression tests: `tests/manual-trigger-actions.test.ts`, `tests/scanner-runner-site-agents.test.ts`, `tests/site-search-agents.test.ts`.
- Status: DONE. Deployment `dpl_DCw82ioXodSVCiaDKLeAgq7ifuSs` reached READY. A production-data full-fleet verification completed 45/45 agents under Chef correlation `2f6ad517-762c-480d-a8dc-329db07b1aec`, fetched 1,358 results, created 28 transient matches, sent 4 Telegram messages with 0 delivery failures, persisted 0 provider results, delisted 0 records, and reported no blocked or failed agents.

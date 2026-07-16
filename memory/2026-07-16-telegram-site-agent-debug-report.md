# Telegram and site-agent fleet debug report

- Time: 2026-07-16 08:46 CEST
- Symptom: No Telegram listing or health notification since the prior evening.
- Root cause: The 42 seeded site agents were all `pending_activation`; the seed excluded public Facebook/Telegram targets and deduplicated Wallapop by host. Brave execution was correctly blocked because neither the environment confirmation nor active storage-rights evidence exists. Health-only Telegram messages were also skipped whenever there were no pending listing alerts.
- Fix: Added catalog reconciliation for one agent per discovery target, centralized Chef correlation IDs for every child run, aggregate site-agent fleet health reporting, and health-only Telegram delivery to verified users.
- Model: 45 independent catalog-target agents plus one Chef Agent. `brave_web` remains the shared provider and is not misrepresented as a marketplace target.
- Evidence: 152 Vitest tests pass; ESLint passes; Next.js 16.2.10 production build passes.
- Regression tests: `tests/source-agent-reconciliation.test.ts`, `tests/scanner-health-site-agents.test.ts`, `tests/opportunity-digest-health.test.ts`.
- Live status: DONE_WITH_CONCERNS. Migration `0031` was applied to production, reconciliation created 45 independent target agents, and Vercel deployment `dpl_4Q9dB1XpSa8AX7g9YvMD9P9MQeaw` reached READY at the production alias. A production digest smoke test returned HTTP 200 with `users=1`, `sent=1`, `failed=0`, `healthIssues=1`. Marketplace discovery remains safely pending until verified Brave storage-rights plan evidence is recorded; ordinary terms prohibit persistent result storage, so the safety gate remains intact.

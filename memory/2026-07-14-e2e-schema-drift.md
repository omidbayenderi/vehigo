# Debug report: vehigo-e2e schema drift

- **Symptom:** The main Playwright flow remained on `/vehicles/new`; the form displayed `Organizasyon bağlamı okunamadı.`
- **Root cause:** `vehigo-e2e` initially lacked `0015`, then temporarily had only `0015`; `0016`–`0025` and therefore the default organization/member seed were absent. The earlier HEAD-based checker produced false positives for missing PostgREST tables and was replaced with a bounded read query.
- **Fix completed:** Applied the missing test-project migrations, added E2E project identity/destructive-cleanup safety, reliable required-schema preflight, and deterministic organization-context provisioning. Direct REST visibility of the internal duplicate-cluster table remains a non-blocking warning because the FK capability and real dedup-consuming E2E flow pass.
- **Evidence:** Required schema capabilities pass; direct `npx playwright test` passed both the dealer-to-PDF and alert-filter flows.
- **Regression test:** `e2e/core-path.spec.ts` main dealer workflow plus `scripts/pretest-e2e.sh` schema/context gates.
- **Status:** DONE_WITH_CONCERNS. The original E2E failure is fixed; the internal duplicate-cluster table's direct REST visibility is tracked separately. The main Supabase project was not used by these checks.

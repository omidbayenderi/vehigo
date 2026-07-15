# Vehigo professional audit and site-search agent architecture

Date: 2026-07-14  
Status: code complete; migrations `0026` and `0027` still require disposable-project acceptance

## Executive verdict

Vehigo has a credible production architecture across all six layers, but it is not yet launch-approved. The deterministic normalization, search, intelligence, export and operations foundations are materially stronger than an MVP. The remaining launch gates are evidence gates: tenant isolation must pass a two-organization adversarial test, the Brave contract must explicitly permit storage, each direct source needs written/API/feed permission, and restore/load/deployed-heartbeat tests remain outstanding.

The new site-search fleet provides one independently leased agent per catalogued marketplace. It performs bounded, paginated `site:<host>` searches through the contracted Brave Search API, rotates saved-search coverage with a cursor, isolates failures per site, records every run, uses exponential retry, enforces per-agent daily query limits and automatically blocks agents on contractual or authorization failures. Scanner runs only ingest and queue alerts; the twice-daily digest route is the sole Telegram delivery path.

It deliberately does **not** rotate proxies. Per-request proxy rotation is commonly used to evade source controls and would make attribution, incident response, legal review and provider accountability worse. Vehigo uses `provider_managed` egress and enables direct API/feed/HTML access only when the source record contains verifiable authority.

## Audit scorecard

| Area | Code maturity | Production evidence | Verdict |
| --- | ---: | ---: | --- |
| Source catalog and permissions | 8/10 | 4/10 | Strong schema; real permission records are missing |
| Connector and ingest runtime | 8/10 | 6/10 | Leases, idempotency, replay and isolation work; site fleet needs live acceptance |
| Canonical normalization | 8/10 | 6/10 | Deterministic and well tested; representative source drift corpus should grow |
| Search and ranking | 8/10 | 6/10 | Explainable strict/discovery and dedup exist; load/query-plan proof missing |
| Market intelligence and AI | 8/10 | 5/10 | Evidence ledger and human review are strong; provider/SLO wiring is incomplete |
| Export and landed cost | 8/10 | 4/10 | Reproducible engine exists; no verified real corridor/rule/rate set yet |
| Tenant security and Storage | 8/10 | 3/10 | `0026` is staged, not adversarially proven or applied to production |
| Operations and recovery | 8/10 | 5/10 | Queue, SLO, budget, maintenance and drills exist; real restore and heartbeat proof missing |
| Site-agent fleet | 8/10 | 2/10 | `0027` and runtime are implemented but not yet applied or live-tested |
| Developer/release discipline | 8/10 | 6/10 | Automated gates and evidence receipts exist; linked migration/canary proof remains |

## Site-agent execution model

```text
15-minute scheduler tick
        |
        v
claim_due_site_search_agents (SKIP LOCKED + lease + daily budget)
        |
        +--> mobile.de agent --------+
        +--> AutoScout24 agent ------+
        +--> TruckScout24 agent -----+--> Brave Search API (provider-managed egress)
        +--> Marktplaats agent ------+
        +--> each catalogued host ---+
                                      |
                                      v
                      canonical listing validation/normalization
                                      |
                            dedup + shared catalog
                                      |
                         tenant watchlist evaluation
                                      |
                         tenant-scoped alert records

Each agent -> run ledger -> health/error/cursor/next-run state
```

### Bounded depth

- One agent owns exactly one `source_key` and one host.
- Queries are generated only from eligible active watchlists.
- The cursor rotates fairly across watchlists so early tenants cannot consume every run.
- Each query returns at most 20 results per page; page depth is bounded and follows the provider's `more_results_available` signal.
- Per-agent query/page depth remains bounded, while each lease reserves at most four actual provider requests.
- Exactly one due agent is claimed per synchronous scheduler tick so work finishes inside the five-minute fenced lease.
- Provider-backed agents run no more frequently than every eight hours; the ten-minute scheduler has spare capacity for at least forty agents without a growing due queue.
- The daily limit is enforced against atomically reserved HTTP requests; unused reservation is released on successful terminal completion.
- 429/timeouts receive bounded exponential retry. The fleet is not activated until storage rights are confirmed; provider authorization failures block only the affected agent.
- Fleet activation is an explicit one-time operator action. Scheduled scans never reactivate paused agents.
- Activation also requires a non-expired `provider_storage_rights_evidence` record containing the contract reference, SHA-256 evidence hash, permitted data classes/territories, retention period and approver. An environment flag alone cannot activate storage.
- Digest candidates are claimed per user with a fifteen-minute UUID lease and fenced completion, preventing concurrent cron/manual runs from selecting the same listing alert. Ambiguous post-Telegram completion is quarantined as `delivery_uncertain` instead of being automatically resent.
- Indexed URLs are canonicalized before identity assignment (HTTPS, normalized host/path, no fragments or common tracking parameters).

## Compliance decisions

1. Brave Search is used as an official machine-readable API, not by scraping a consumer search page.
2. `BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED=true` is mandatory because Vehigo persists URLs, snippets and derived listing records. Brave's standard Search API terms prohibit storing Search Results beyond transient operation; the flag may only be enabled under an Order Form/plan that explicitly grants storage rights. See <https://api-dashboard.search.brave.com/documentation/resources/terms-of-service> and <https://brave.com/search/api/>.
3. The Marktplaats HTML parser remains as a contract-tested dormant module but is removed from the runtime registry. Its direct source is disabled until explicit permission is recorded.
4. Site agents discover indexed listing evidence; they do not bypass login, CAPTCHA, rate limits or robots controls.
5. A deeper first-party connector can replace an index agent only through an official API, partner feed, saved-search email or documented permitted HTML agreement.

## Findings requiring closure

### P0 — before any production rollout

- Apply `0026` to `vehigo-e2e` and pass two-user/two-organization DB, API and Storage isolation tests.
- Apply `0027` to `vehigo-e2e` and prove fenced leases, cursor rotation, per-site failure isolation, exact request budgets and atomic run-ledger transitions.
- Obtain a Brave Order Form/storage-rights plan (or replace Brave with a provider whose contract permits persistence), record the evidence reference, and only then set the confirmation flag. Until then, production deploys fail closed and keep the fleet paused.
- Record at least one sustainable source permission path and one real export corridor with verified rule/rate/document sources.

### P1 — production hardening

- Add a stale-scheduler heartbeat alert independent from the scheduler being monitored.
- Connect site-agent requests to the existing provider SLO and cost-budget ledger.
- Run representative-volume search/load tests and capture `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- Perform a real isolated backup restore and record measured RPO/RTO.
- Define retention/data-minimization rules for seller names, snippets and raw indexed evidence; these fields may contain personal data.
- Add an operator screen for platform admins to pause/unblock agents, change budgets and inspect per-site run history.

### P2 — coverage quality

- Add source-specific query language, category and locale profiles.
- Track field-coverage drift and false-positive rates per agent.
- Add partner/API connectors where index snippets do not provide price, mileage, seller type or stable availability.
- Add canary deployment and automatic rollback evidence.

## Verification completed in the repository

- Migration sequence now contains 27 contiguous files and the latent `0015` SQL typo was corrected.
- Direct unverified Marktplaats execution is absent from the runtime registry.
- Site-specific query isolation, cursor rotation, Brave pagination and storage-rights fail-closed behavior have unit coverage.
- Current unit suite, lint, TypeScript and diff checks are the required local gate; linked database and live E2E gates remain separate and must not be claimed from code alone.

## Rollout order

1. Apply and validate `0026` in `vehigo-e2e`.
2. Apply and validate `0027` in `vehigo-e2e`.
3. Confirm provider storage rights and configure the test project.
4. Run tenant adversarial acceptance.
5. Run site-agent fleet acceptance with one success, one 429 retry, one timeout and one terminal authorization block.
6. Run the complete E2E, operation acceptance, unit, lint, type and production-build gates.
7. Only then schedule a backed-up, monitored production migration.

# Vehigo production-readiness test plan

Generated from the final engineering review on 2026-07-14.

## Affected pages and routes

- `/dashboard` — all metrics and activity must reflect only the selected organization.
- `/vehicles`, `/leads`, `/matches`, `/offers`, `/messages` — tenant-private CRUD and cross-entity ownership.
- `/alerts` and `/api/search/*` — shared catalog reads combined with tenant-private watchlists, alerts and decisions.
- `/api/intelligence/*` — tenant-scoped AI ledger, evidence access, budget enforcement and human decisions.
- `/exports` and `/api/exports/*` — tenant scenarios/results/documents with platform-governed routes, rules and rates.
- `/operations` and `/api/operations/*` — tenant owner authorization, exact health, replay, policy and drill behavior.
- `/api/scanner/*` — service authorization, source isolation, ingest idempotency and runtime observation.
- `/api/operations/maintenance` — bearer authorization, heartbeat, maintenance results and absence detection.

## Critical paths

1. Platform administrator configures a permitted source and verified export references; organization owner can read but cannot mutate them.
2. Organization A creates a vehicle, lead, watchlist, AI evaluation, export scenario and offer; organization B cannot read, mutate, link to or download any A-private artifact.
3. A permitted source ingests a listing, normalization/indexing succeeds, a tenant watchlist matches it, a partial source outage is disclosed and unrelated sources continue.
4. AI eligibility is deterministic; an allowed call consumes an organization budget and records provider evidence; a hard-limit or timeout produces a recoverable state without losing the baseline analysis.
5. Export calculation refuses missing or unverified rule/rate/document data; verified evidence unlocks approval; generated PDF carries the matching result hash.
6. Operation job retries after an expired lease, dead-letters after exhaustion and replays once under an organization owner without duplicate side effects.
7. Missing maintenance heartbeat opens one actionable alert; resumed healthy runs resolve it without inflating occurrence counts.
8. An isolated backup restore meets declared RPO/RTO and passes tenant isolation plus the core search-to-approved-export smoke flow.

## Key interactions

- Switch between two organizations and verify every list, count, mutation and owner-only control changes scope together.
- Keep a page open, switch organization in another tab, then submit the stale form; the server must reject the mismatch.
- Double-submit create/calculate/replay actions; one durable outcome must result.
- Lose network or force a 500 during search, AI, export and operations mutations; retained work and safe retry must be visible.
- Open an external listing, return to the opportunity list and distinguish already evaluated sources accessibly.
- Complete and fail recovery drills; evidence is mandatory and alert transitions match the result.

## Edge cases

- User with zero, one and multiple active organization memberships.
- Suspended member, suspended organization, removed owner and attempted last-owner demotion.
- Child entity references a parent from another organization.
- Direct UUID/path guessing against database APIs and Storage.
- Empty, stale, legally blocked and partially failed source sets.
- Duplicate idempotency key with same payload versus different payload.
- Lease expiry during execution, concurrent worker claims and concurrent owner replay.
- AI key missing, invalid model, 429, timeout, malformed provider response and budget race.
- Missing, expired or conflicting exchange-rate snapshots and rule versions.
- 0, 1, 50, 10,000 and target-scale operation/search rows.
- Maintenance invoked with missing, wrong and rotated secrets; scheduler stops completely.
- 375px, 768px, desktop, landscape, 200% zoom, keyboard-only, screen reader and both themes.

## Launch evidence

- Automated unit/integration/E2E/eval/load suites with immutable run references.
- Fresh staging migration log and generated schema types.
- Two-tenant database/API/Storage denial matrix.
- Representative query plans and p50/p95/p99 results.
- Real backup-restore drill record with RPO/RTO and post-restore hashes.
- Deployed scheduler heartbeat and external stale-run alert.
- Verified source permission and export rule/rate/document evidence for the first production corridor.

<!-- /autoplan restore point: /Users/omidbayanadarimoghaddam/.gstack/projects/Vehigo/main-autoplan-restore-20260714-000001.md -->
# Vehigo final architecture and production-readiness review

## Objective

Verify the implemented product against the original six-layer Vehigo architecture and produce an executable closure plan for every gap that prevents a real production launch. This is a review plan, not a claim that all production dependencies are already satisfied.

## Product outcome

Vehigo should let professional dealers and exporters discover legally acquired European vehicle listings, compare normalized inventory, evaluate evidence-backed market and risk signals, calculate reproducible country-specific landed cost, and manage the resulting commercial workflow without losing provenance or organizational isolation.

## Reference architecture

1. **Source layer:** A registry that can grow toward 100+ sources while preserving acquisition method, permission, terms, health, geography, and source evidence.
2. **Connector layer:** Versioned, isolated connectors that return one canonical contract and support idempotent ingest, replay, throttling, and failure containment.
3. **Normalization layer:** Provenance-preserving canonical vehicles, taxonomy resolution, quality scoring, deduplication, quarantine, and deterministic replay.
4. **Search engine:** Index-first federated search, strong filters, geographic groups/radius, saved searches, natural-language planning, and predictable freshness.
5. **AI layer:** Evidence-linked market, risk, anomaly, and export-potential analysis with model/prompt versions, cost budgets, confidence, and human decisions.
6. **Export layer:** Versioned routes, verified rules/rates/documents, deterministic landed-cost calculation, approval gates, offers, PDFs, and audit evidence.

The cross-cutting product operations plane includes organization isolation, queue/lease/retry/dead-letter behavior, structured correlation events, SLOs, budgets, rate limits, retention, recovery drills, and owner controls.

## Review scope

- Map every reference capability to migrations, runtime modules, routes, UI, tests, and deployment automation.
- Verify authorization and organization isolation across both new operations tables and legacy dealer-workspace tables.
- Verify failure boundaries, replay safety, audit provenance, retention, backup/restore readiness, secrets, cron execution, and deployment configuration.
- Review the production UI for operator clarity, accessibility, responsive behavior, and rescue paths.
- Review developer onboarding, environment validation, migrations, local verification, deployment instructions, and actionable error messages.
- Separate implemented-and-verified capabilities from code-only, configuration-dependent, real-data-dependent, and missing capabilities.

## Acceptance standard

- No unsupported production-readiness claim.
- Every critical gap has an owner, implementation boundary, verification method, and dependency.
- Real data, legal permissions, customs rules, exchange rates, backup/PITR, and external secrets are never fabricated.
- Automated tests cover authorization, failure isolation, idempotency, replay, policy enforcement, and deterministic calculations.
- The final report ends with a prioritized implementation sequence suitable for continuing work one item at a time.

## Confirmed premise

Vehigo will be reviewed and launched as a **multi-tenant SaaS**, not as a single-company internal tool or an MVP pilot. Production readiness therefore requires organization isolation across the complete dealer, marketplace, intelligence, export, audit, storage, and operations data graph.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Treat multi-tenant isolation as a launch gate | User-confirmed premise | Completeness | The user accepted multi-tenant SaaS as the product boundary; single-organization acceptance cannot prove tenant safety. | Single-company launch and controlled-pilot readiness |
| 2 | CEO | Use a launch-gate-first closure sequence | Auto-decided | Explicit over clever | Close tenant safety, real-data provenance, staging and recovery before expanding the source count. | Cosmetic launch polish before safety evidence |
| 3 | CEO | Hold the six-layer scope | Auto-decided | DRY | The architecture already covers the intended platform; the problem is incomplete proof and cross-cutting isolation, not a missing seventh domain layer. | Rewrite or broad feature expansion |
| 4 | Design | Preserve the current visual system | Auto-decided | Minimal diff | The system is coherent; production trust and recovery states create more value than rebranding. | New component library or aesthetic rewrite |
| 5 | Engineering | Classify data as shared, governed or tenant-private | Auto-decided | Explicit over clever | Shared catalog efficiency and tenant confidentiality require different policies. | Tenant-copy every listing or globally expose commercial data |
| 6 | Engineering | Separate platform administrator from organization owner | Auto-decided | Completeness | A customer owner must not mutate platform-wide source, rule or rate governance. | Continue using global profile owner for both roles |
| 7 | DX | Make local/staging verification command-driven | Auto-decided | Pragmatic | A real product needs reproducible receipts, not knowledge of a manual dashboard sequence. | Preserve SQL Editor as the primary deployment workflow |

## Phase 1 — CEO and product premise review

### Premise challenge

The problem is real: professional dealers and exporters currently combine fragmented marketplace discovery, manual comparison, uncertain risk assessment, landed-cost spreadsheets, and CRM work. Vehigo's durable value is not “more listings”; it is a defensible decision record from source evidence to approved quote. The six-layer architecture is the right framing because each layer owns a distinct trust transformation, but a source-count claim such as “100+” is an outcome of sustainable acquisition agreements, not an engineering acceptance criterion.

Doing nothing leaves operators with slow manual work and no reproducible evidence chain. Shipping the current code as a multi-tenant SaaS would create a worse outcome because legacy RLS policies can expose authenticated data across organizations. The direct product path is therefore launch-gate-first: prove tenant safety and one real commercial corridor end to end, then widen source and destination coverage.

### What already exists

- Source catalog metadata, runtime connector manifests, catalog drift checks, scheduling state and connector health foundations.
- Canonical normalization, source evidence, fingerprints, warnings, confidence and cross-source duplicate clustering.
- Indexed structured search, geography presets/radius, strict/discovery semantics, freshness and natural-language planning.
- Reproducible comparable snapshots, risk signals, AI ledger, media-rights gate and human decision fields.
- Versioned export routes/rules/rates, deterministic landed cost, sensitivity, document gates, approval and PDF evidence hash.
- Queue/lease/retry/dead-letter operations, correlation events, SLO/budget/rate-limit controls, recovery drills and owner console.

### NOT in scope for the closure plan

- Building dozens of speculative scrapers for sites without verified permission, API, feed, email, partner or permitted HTML acquisition.
- Fabricating customs rules, exchange rates, documents, market comparables, image rights or backup/PITR evidence.
- Rewriting the existing six layers into microservices before load or team boundaries require it.
- Claiming live search against 50 connectors until connector agreements, latency budgets and failure isolation are proven.
- Native mobile applications, payment custody, legal approval automation or autonomous vehicle-purchase execution.

### Implementation alternatives

**Approach A — Minimal closure:** keep the default organization and market the product as an internal single-company tool. Effort is small and current acceptance tests largely apply, but it contradicts the confirmed SaaS premise and preserves unsafe global policies.

**Approach B — Architecture rewrite:** split catalog, ingest, search, AI, export and operations into independent services now. The boundaries are clean at 100x scale, but distributed transactions, deployment, tracing and team burden would delay proof of the commercial corridor without solving missing legal/data evidence.

**Approach C — Launch-gate-first (selected):** keep the modular monolith, add organization ownership to the full data graph, backfill and enforce it additively, prove a licensed/permitted source corridor plus verified export data, then run tenant, restore, load and staged-rollout acceptance. This preserves the working layers while closing the exact risks that make the current product non-launchable.

### Dream-state delta

```text
CURRENT                         CLOSURE PLAN                         12-MONTH IDEAL
Strong single-org code     ->  tenant-safe data graph          ->  many organizations
Few runtime connectors     ->  one verified source corridor    ->  partner/API/feed catalog
Code-ready export engine   ->  verified rule/rate/doc evidence ->  multiple governed destinations
Local/live acceptances     ->  staging + restore + load gates   ->  routine canary releases
Operator console           ->  tenant/source SLO ownership      ->  self-serve enterprise controls
```

### Product architecture and user flow

```text
Permitted source/API/feed/email
              |
              v
Source catalog -> connector runtime -> immutable raw evidence
                                          |
                                          v
                               canonical normalization
                                          |
                              +-----------+-----------+
                              v                       v
                       indexed search          evidence snapshots
                              |                       |
                              v                       v
                       dealer workspace       deterministic + AI review
                              \                       /
                               +---- export scenario +
                                          |
                                  document/approval gate
                                          |
                                  offer + evidence PDF

Every persisted node -> organization_id -> RLS membership boundary
Every async edge      -> operation job -> correlation/event/SLO/replay
```

### Error and rescue registry

| Codepath | Failure | Current rescue | User/operator result | Gap |
|---|---|---|---|---|
| Connector acquisition | timeout, 429, malformed source | bounded runner/retry and source failure state | unrelated connectors continue | provider-specific retry-after/circuit evidence is incomplete |
| Ingest registration | invalid/empty/conflicting payload | validation, idempotency conflict, dead-letter/replay | event ID and explicit error | strong foundation |
| Normalization | missing/unknown fields | warnings and unknown preservation | discovery/strict semantics remain explicit | alias governance UI and drift metrics are limited |
| Search | stale/partial index | freshness metadata and local results | results can remain partial | user-facing coverage/freshness summary is incomplete |
| AI review | missing key, budget, timeout, malformed output | skipped/failed ledger state | deterministic snapshot survives | provider observation/SLO is not wired into every AI call |
| Export calculation | missing rule/rate/document | calculation/approval blocker | no invented total | real verified rule/rate set is absent |
| Maintenance cron | bad secret, deploy/network failure | HTTP failure and workflow retry | operator must inspect workflow | no independent alert on repeated cron absence |
| Recovery | restore unavailable or stale | runbook and drill ledger | manual escalation | no completed real backup_restore evidence |

### Failure modes registry

| Failure mode | User impact | Severity | Launch status | Required response |
|---|---|---:|---|---|
| Cross-organization read via legacy `authenticated` policy | confidential dealer/customer/export data exposure | Critical | BLOCKER | tenant migration, RLS replacement, adversarial two-tenant tests |
| Unsupported source acquisition | legal/commercial interruption and missing inventory | Critical | BLOCKER per source | permission evidence and acquisition-mode gate |
| Missing verified customs/rate/doc data | misleading margin and export decision | Critical | BLOCKER per destination | owner-approved sourced rule set and rate snapshot |
| No real restore drill | recovery time and data loss are unknown | Critical | BLOCKER | isolated restore with measured RTO/RPO evidence |
| Cron secret/deploy mismatch | leases and retention silently stop | High | BLOCKER | deployed smoke test plus stale-maintenance alert |
| AI provider outage | AI cards unavailable | Medium | tolerated | deterministic analysis remains, ledger/SLO alert records failure |
| One connector outage | one source becomes stale | Medium | tolerated | source-isolated retry/dead-letter, coverage notice |
| 100x listing volume | slow search, comparison and admin reads | High | unproven | representative dataset load tests and query plans |

### CEO review scores

| Dimension | Score | Finding |
|---|---:|---|
| Product premise | 9/10 | Strong professional decision-support wedge; source count must not replace trust. |
| User value | 8/10 | Search-to-quote chain is valuable, but real corridor evidence is not yet present. |
| Scope | 8/10 | Six layers are coherent; closure should avoid a rewrite or speculative connectors. |
| Launch criteria | 4/10 | Code gates exist, but tenant, restore, load and deployment evidence are incomplete. |
| Business dependencies | 3/10 | Permissions, rule sources, rates and documents remain external blockers. |
| Feasibility | 8/10 | Modular monolith and additive migrations provide a credible path. |

### CEO completion summary

**Verdict: proceed with the architecture, do not launch yet.** The product direction is sound and the repository contains substantial working foundations in all six layers. Production closure must begin with full tenant isolation, then verified source/export evidence, then restore/load/staged deployment proof. The independent subagent stalled and the external Codex CLI was blocked by the privacy reviewer, so CEO dual-voice consensus is unavailable; this phase relies on local repository evidence and explicitly carries that limitation.

## Phase 2 — Product design and operator-experience review

### Design intent

Vehigo is an operational application, not a marketing surface. Its interface must help a dealer or operator answer four questions without inference: **what is known, how fresh and complete it is, what is blocked, and what action safely advances the workflow**. The current design system supports this direction; the remaining work is mostly state communication and production-grade rescue behavior rather than a visual redesign.

### What already exists

- A coherent semantic color system with light/dark themes, visible focus treatment, reduced-motion support and 44px minimum form controls.
- Stable dashboard navigation, a compact mobile header, responsive content widths and RTL/Persian font handling.
- Reusable page headers, cards, pills, empty states and form patterns across search, alerts, export and operations.
- Useful domain status language: opportunity score, stale/delisted state, rule-set verification, document gates, job status, severity, recovery-drill state and correlation IDs.
- Inline success/error announcements in the export workspace and disabled/pending behavior for important mutations.
- A dense but logically grouped operations console covering health, jobs, alerts, policies, drills and events.

### NOT in scope for design closure

- Rebranding Vehigo, replacing the type system, or introducing a new component library.
- Decorative dashboards, gratuitous gradients, glass effects, animated charts or card mosaics with no operational value.
- Hiding legal/data uncertainty behind a simplified confidence score.
- Producing a native mobile navigation model before the responsive web workflow is verified.

### Information architecture

```text
Global navigation
├── Discover
│   ├── Search and coverage
│   └── Watchlists and opportunity flow
├── Decide
│   ├── Deterministic market snapshot
│   ├── AI/risk evidence
│   └── Human accept/reject decision
├── Export
│   ├── Scenario assumptions
│   ├── Calculation and sensitivity
│   ├── Document gate
│   └── Approval/evidence PDF
└── Operate (owner)
    ├── Platform health
    ├── Actionable incidents
    ├── Jobs and replay
    ├── Policies and budgets
    └── Recovery drills
```

The existing page grouping broadly follows this model. The largest missing navigational concept is an explicit organization context and a cross-layer **coverage/readiness** view. In a multi-tenant product, users must always know which organization they are acting for; owners also need one place that distinguishes healthy, degraded, blocked and unconfigured layers.

### State-coverage matrix

| Surface | Loading | Empty | Error | Success | Partial/degraded | Required closure |
|---|---|---|---|---|---|---|
| Search/results | request-level pending exists in components | results/watchlist empties exist | mostly local/generic | result list and filters | freshness values exist but coverage is fragmented | show searched sources, failed/stale sources, index time and retry path in one summary |
| Opportunity/AI | action pending and ledger state | missing snapshot copy exists | failed/skipped states are stored | evidence and decision controls exist | deterministic result survives AI failure | explain provider/budget/rights reason and whether retry is allowed |
| Export | mutation pending | scenario empty state exists | inline alert exists | inline status plus refreshed result | calculation blockers exist | make missing rule/rate/document blockers persistent and link directly to owner action |
| Operations | server-rendered current state | per-section empty messages | thrown server error | metrics/jobs/events visible | no whole-page degraded banner | add route error boundary, retry, last-maintenance heartbeat and stale-data warning |
| Recovery drill | pending buttons | no-drill empty exists | action error handling exists | passed/failed evidence visible | overdue and running are visible | make evidence requirements and next owner action explicit before completion |

No route-level `loading.tsx` or `error.tsx` boundary was found for the critical dashboard workspaces. A transient database or network failure therefore becomes a framework-level failure instead of a branded, actionable recovery state. This is a P1 production usability gap.

### Critical user journey

```text
1. Choose organization
       ↓
2. Search permitted sources ── degraded source? ──> show partial coverage + retry/status
       ↓
3. Inspect normalized evidence ── stale/missing? ──> disclose age and exclusion reason
       ↓
4. Review deterministic + AI insight ── AI unavailable? ──> preserve baseline + explain
       ↓
5. Create export scenario ── rule/rate/doc missing? ──> block total/approval + owner task
       ↓
6. Approve and produce evidence ── failure? ──> retain draft/idempotency + safe retry
```

The desired emotional arc is **orientation → evidence → controlled confidence → deliberate commitment**. Current screens are strongest in the evidence and commitment stages. Orientation is weaker because organization, source coverage and data freshness are not consistently summarized. Failure recovery is also inconsistent between client-managed workspaces and server-rendered pages.

### AI-slop and application-UI check

| Check | Result |
|---|---|
| One visual system, not a collage of styles | Pass |
| Cards represent real interactive/status groupings | Mostly pass; operations needs stronger priority hierarchy |
| Semantic colors and tokens | Pass; a few inline raw colors remain in product code |
| Typography has a clear hierarchy | Pass |
| Dense metadata remains readable | Partial; repeated `text-xs`/11px content is too small for critical operational meaning |
| Empty/loading/error/partial states feel authored | Partial; empty states are good, route loading/error and degraded coverage are missing |
| Every status leads to a clear next action | Partial; export blockers and operational degradation do not always link to remediation |

### Design-system alignment

Keep the existing Geist/Fraunces/Vazirmatn stack and semantic tokens. Consolidate remaining raw colors into semantic status/border tokens, promote critical metadata to at least the normal supporting-text size, and define one shared component family for:

- `CoverageSummary`: sources searched, succeeded, stale, blocked and last indexed time.
- `DataTrustBanner`: verified, provisional, stale, incomplete and legally blocked states.
- `RecoveryPanel`: cause, retained work, safe retry, owner escalation and correlation ID.
- `OrganizationContext`: current tenant, switch affordance and platform-admin distinction.

These are cross-layer trust primitives, not cosmetic abstractions.

### Responsive and accessibility review

- The layout has sensible mobile/desktop navigation, touch targets and responsive grids, but no recorded 375px, 768px, landscape or zoom acceptance evidence.
- Visible focus and reduced motion are implemented globally. Form controls generally use labels and mutation messages use `status`/`alert` roles.
- Automated axe/accessibility regression coverage was not found; keyboard-only order, disclosure widgets, focus restoration after actions, contrast in both themes and screen-reader announcements remain unproven.
- External listing links use icons with titles in places, but should have stable accessible names and a consistent indication that a new tab opens.
- Visited-link distinction is not globally defined, which makes repeated source evaluation harder for high-volume dealer workflows.
- Operations and alert cards rely heavily on 11–12px status metadata. Compact metadata is acceptable, but errors, freshness, blockers and required actions must not depend on sub-16px text alone.

### Design implementation tasks

| Priority | Task | Acceptance |
|---|---|---|
| P1 | Add persistent organization context to the authenticated shell | current organization is always visible; switching refreshes scoped data; platform administration is visually distinct |
| P1 | Add shared coverage/freshness/degradation summary to search and opportunity flow | successful, failed, stale and legally unavailable sources are named; partial results are never presented as complete |
| P1 | Add route-level loading and error/retry boundaries for search, alerts, export and operations | each critical route has branded loading, recoverable error, correlation/reference and safe retry behavior |
| P1 | Turn export prerequisites into an ordered remediation checklist | missing verified rule, rate or document blocks the exact downstream action and links owners to the required control |
| P1 | Add automated accessibility and responsive acceptance | axe plus keyboard smoke tests; 375/768/desktop and 200% zoom snapshots; light/dark contrast checks |
| P2 | Reorder operations around open critical alerts and stale maintenance before metrics/history | urgent actions appear first; decorative metric repetition is reduced; raw 50-row counts are not presented as global totals |
| P2 | Normalize status, recovery and trust components | same state has the same label, color, explanation and next action in every layer |
| P2 | Improve evaluated-source wayfinding | visited external links are distinguishable without relying only on color; new-tab behavior is announced |

### Design review scores

| Dimension | Score | Finding |
|---|---:|---|
| Information architecture | 7/10 | Six-layer workspaces are understandable; tenant context and readiness overview are missing. |
| State coverage | 5/10 | Empty/success states are good, but route error/loading and partial-coverage rescue are incomplete. |
| Journey and confidence | 7/10 | Evidence-to-decision flow is strong; orientation and degraded-state communication need work. |
| AI-slop resistance | 8/10 | Restrained application UI with purposeful components; no redesign is needed. |
| Design-system alignment | 8/10 | Strong semantic foundation with a few raw-color and trust-component gaps. |
| Responsive/accessibility | 6/10 | Good code-level foundations, insufficient automated and device-level proof. |
| Decision closure | 6/10 | Primary actions are clear; organization switching and some recovery choices remain unresolved. |

### Design completion summary

**Verdict: preserve the current visual system and close production trust states.** The interface does not need aesthetic expansion. It needs consistent organization context, source coverage/freshness disclosure, route-level recovery, explicit export remediation and verified accessibility/responsive behavior. No product code was changed during this review.

## Phase 3 — Engineering, security, scale and test review

### Selected engineering posture

Keep the modular monolith and make data ownership explicit before connecting more workloads to it. Tenant isolation is not achieved by adding `organization_id` only to the operations plane. It requires a classified data graph, additive backfill, foreign-key consistency, tenant-aware RLS, tenant-aware object paths, service-layer context and adversarial tests.

The selected model has three classes:

| Class | Examples | Ownership and access |
|---|---|---|
| Shared catalog | source definitions, permitted connector manifests, canonical marketplace listings, price history, duplicate clusters | platform-governed; authenticated tenant members may read; only service/platform-admin writes |
| Governed reference | export routes, verified rule sets/rules, exchange-rate snapshots, taxonomy/aliases | platform-governed and versioned; readable by tenants; organization owners must not gain platform-wide write authority |
| Tenant-private | dealer vehicles/images, leads/activity, matches, offers/PDFs, compliance, messages, watchlists, listing alerts/decisions, AI evaluations, export scenarios/results/documents, audit and operation data | mandatory `organization_id`; active membership RLS; role-sensitive writes; tenant-prefixed storage |

This avoids duplicating the European market catalog per customer while closing access to commercial and personal data.

### What already exists

- Additive migrations with stable foreign keys and deterministic hashes across ingest, intelligence and export.
- Organization/membership primitives, organization-aware audit/ingest tables and tenant-scoped operations tables.
- A general queue runtime with idempotency keys, leases, `skip locked`, bounded retry, dead-letter replay and retention.
- Provider SLO, budget, rate-limit and recovery-drill database controls with live acceptance scripts.
- Deterministic pure functions for normalization, search, risk, intelligence and landed-cost calculations with unit coverage.
- Server-side authorization helpers for owner-only operations and bearer-secret validation for maintenance.
- One isolated Playwright business-flow test plus 21 unit-test files/101 passing tests in the last acceptance run.

### NOT in scope for engineering closure

- Splitting the six layers into distributed services before load evidence or team ownership requires it.
- Tenant-copying the shared listing catalog and price history.
- Implementing arbitrary source scrapers, customs data or rates without permission and provenance.
- Replacing Supabase Auth/RLS, Postgres queues or the current deployment platform without a measured limitation.
- Treating a platform administrator as an organization owner; these are separate authority domains.

### Target data and execution flow

```text
                     PLATFORM-GOVERNED
 source/connector -> raw evidence -> canonical listing/index -> rules/rates
       service role      service role       tenant read          tenant read
             |                |                  |                    |
             +----------------+------------------+--------------------+
                                              references only
                                                    |
                         TENANT-PRIVATE             v
 organization -> watchlist -> alert -> AI evaluation -> export scenario
       |             |          |           |                |
       +-> vehicle -> lead -> match -> offer + PDF/storage    |
       |                                                      |
       +-> audit <- operation job/event/SLO/budget/recovery <-+

Invariant: every tenant-private edge has the same organization_id as its parent.
Invariant: platform-admin writes governed reference data; org-owner cannot.
Invariant: every async external call emits correlation, budget and provider evidence.
```

### Architecture findings and decisions

#### P0 — Legacy tenant-private graph is globally readable

`0001_init.sql` permits all authenticated users to read vehicles, vehicle images, leads, activity, matches, offers, compliance, message drafts and Storage objects. `0002_market_alerts.sql` scopes watchlists and listing alerts by user rather than organization. `0018_market_intelligence_and_ai_ledger.sql` and `0019_export_scenario_engine.sql` do not carry organization ownership across AI and export records. An authenticated user in organization B can therefore reach organization A data where policies are global.

**Decision:** introduce additive migration `0026` in staged steps: add nullable ownership columns, backfill the existing graph to the default organization, validate parent-child organization equality, create indexes, replace RLS/storage policies, run two-tenant tests, then set columns `NOT NULL`. Do not perform a destructive table rewrite.

#### P0 — Platform authority and organization authority are conflated

The legacy `users_profile.role = 'owner'` grants global management over source/media/export reference data, while new operations use organization membership roles. In a SaaS product, an organization owner must not edit global customs rules, exchange-rate sources or source permission records.

**Decision:** add an explicit platform authority, for example a non-self-editable `platform_admins` relation or signed custom claim, and reserve governed catalog mutations for that authority/service role. Keep `organization_members.role` for tenant actions only. Retire business authorization that reads the global profile role after migration.

#### P0 — Storage is not tenant-isolated

The `vehicle-images` and `offer-pdfs` bucket policies allow any authenticated user to read and insert objects. Database RLS cannot protect a directly guessed object path.

**Decision:** use immutable paths beginning with `{organization_id}/...`, enforce active membership against the first folder segment in Storage RLS, verify the linked vehicle/offer belongs to the same tenant, and migrate existing objects with a recorded manifest and rollback procedure.

#### P1 — Organization context is incomplete

The operations API accepts `x-organization-id`, while the server page selects the first owner organization and throws when multiple matches exist in the helper. Other workspaces have no selected-organization contract at all.

**Decision:** create one server-validated organization-context service backed by an HttpOnly preference/canonical route context. Every tenant query and mutation receives this context; client-provided IDs are hints, never authority. Add a switcher and reject cross-tenant foreign keys at the database boundary.

#### P1 — The operations plane is adjacent to core workloads, not yet their runtime

The generic queue/control APIs are implemented and tested, but production scanner, AI and export code does not call `enqueueOperation`, `consumeUsageBudget` or `recordProviderObservation`. AI calls remain synchronous and use a separate global monthly spend query.

**Decision:** adopt the runtime incrementally by workload: connector acquisition first, AI evaluations second, expensive export/document work third. Each adapter owns a job type/version, schema, idempotency key, provider key, retry classification and safe replay rule. Keep deterministic local calculations synchronous.

#### P1 — AI budget and provider controls are not tenant-safe

`currentMonthSpend` reads up to 5,000 AI rows across the visible dataset and sums in application memory. It neither scopes by organization nor uses the new atomic usage ledger. The default model string is configuration-dependent and there is no startup validation of model/pricing settings.

**Decision:** consume an organization-scoped atomic budget before the provider call, record actual usage/cost afterward, emit a provider observation on success/timeout/error and require explicit model plus pricing configuration in production. Replace the 5,000-row scan with database aggregation/ledger accounting.

#### P1 — Maintenance can fail silently

The scheduled workflow calls the endpoint every five minutes, but no independent monitor proves that a run happened. GitHub schedules can be delayed, a secret can drift, or the deployment can disappear. Overdue-drill conflict updates also increment occurrence count every maintenance cycle and the overdue warning is not explicitly resolved when a drill starts.

**Decision:** persist a maintenance heartbeat/run ledger, alert externally when it becomes stale, resolve overdue alerts on drill start/completion and increment occurrences only for meaningful transitions or bounded notification windows.

#### P1 — Operations headline counts are inaccurate above 50 jobs

The page derives queued/running/retry/dead-letter totals from the latest 50 job rows even though the overview endpoint already issues exact count queries. Under load, the console can understate a queue incident.

**Decision:** use exact/head counts or a database aggregate for headline health; keep the 50-row query only for recent history.

#### P1 — Migration/deployment evidence can drift

Migrations `0015`–`0025` were applied manually through SQL Editor. That proves SQL acceptance but may not populate the CLI migration history expected by automated deploys. Most of the phase work is also currently uncommitted, so repository state is not yet a reproducible release artifact.

**Decision:** reconcile the remote migration ledger, verify checksums/order in a fresh staging project, generate types from that schema, then package the work into reviewed commits. Never repair migration history by silently editing already-applied files.

### State-machine invariants

```text
operation job:
queued -> leased -> running -> succeeded
   |        |          |
   |        +-- lease expired --> retry_wait -> leased
   |                               |
   +-------------------------------+-- attempts exhausted --> dead_letter
dead_letter -- owner replay --> queued

recovery drill:
planned -> running -> passed
                    -> failed -> critical alert

export scenario:
draft -> calculated -> needs_review/pending -> approved
           ^               |
           +-- rule/rate/document change invalidates approval
```

Database functions should carry inline ASCII state comments because job lease recovery, export approval invalidation and recovery-drill alert transitions are not obvious from individual statements. Application services should not duplicate these transition rules.

### Security and privacy review

| Risk | Current control | Gap | Required proof |
|---|---|---|---|
| Cross-tenant database access | RLS exists | legacy policies are global/user-scoped | two organizations, every tenant-private table, positive and negative CRUD matrix |
| Cross-tenant object access | authenticated bucket policy | path is not tenant-scoped | signed/direct read and write attempts across tenants fail |
| Privilege escalation | profile self-role update removed; org role RPC protects last owner | global owner still conflates platform authority | org owner cannot mutate platform reference data or another tenant |
| Service secret leakage | server env and bearer comparison | configuration/deploy proof missing | secret rotation drill, redacted logs, invalid/missing secret tests |
| Unsafe replay | idempotency/hash/lease controls | core workloads not yet integrated | duplicate, conflicting payload, expired evidence and concurrent replay tests |
| Personal/commercial retention | operation retention exists | tenant business data retention/export/deletion policy missing | documented lifecycle, legal hold, deletion and tenant offboarding test |

### Performance review

- The shared index and duplicate model are the right architecture for many tenants. Do not duplicate catalog rows per organization.
- Operations claim queries have partial indexes and `skip locked`; representative concurrency remains unmeasured.
- The dashboard performs parallel reads, but exact aggregate counts and bounded pagination must replace client/application-memory counting.
- AI spend aggregation, export scenario hydration and large watchlist matching need database-level measurement at 1x, 10x and 100x representative volumes.
- Search acceptance needs `EXPLAIN (ANALYZE, BUFFERS)` for common strict/discovery, geographic and freshness query shapes plus p50/p95/p99 latency budgets.
- Retention functions should delete/scrub in bounded batches to avoid long locks as operation/provider tables grow.

### Test coverage map

```text
CODE PATHS                                         USER/OPERATOR FLOWS
[★★★] pure normalization/search/risk/cost          [★★] vehicle -> lead -> offer -> PDF E2E
[★★★] ingest idempotency/replay lifecycle          [★★] watchlist vehicle filters E2E
[★★★] queue lease/retry/dead-letter units          [GAP][→E2E] organization switch and scoped CRUD
[★★★] maintenance/drill live acceptance            [GAP][→E2E] two-tenant adversarial data/storage access
[★★ ] source/connector contracts                   [GAP][→E2E] source -> ingest -> index -> alert with partial outage
[★★ ] AI deterministic eligibility                 [GAP][→EVAL] market/damage prompt safety and evidence fidelity
[GAP] platform-admin versus org-owner matrix        [GAP][→E2E] export rule/rate/doc block -> approval -> PDF
[GAP] tenant parent-child invariants                [GAP][→E2E] cron absent -> heartbeat alert -> recovery
[GAP] concurrent claims/replays at load             [GAP][→E2E] real backup restore and measured RTO/RPO

Legend: ★★★ edge/error behavior | ★★ primary happy behavior | GAP required before launch
```

The existing suite is valuable but dominated by pure-function tests. The live acceptance scripts run against the default single organization, so they do not prove the confirmed SaaS boundary. No regression may be accepted without a test that demonstrates organization B cannot read, mutate, link to or retrieve organization A data.

### Required engineering test plan

| Priority | Test | Type | Exact assertion |
|---|---|---|---|
| P0 | tenant RLS matrix | database integration | member A can CRUD allowed rows in A; member B receives zero rows/denial for every tenant-private table and relation |
| P0 | tenant Storage matrix | integration | B cannot select/download/insert/update/delete under A prefix; A cannot attach an object to a B entity |
| P0 | authority separation | database/API integration | org owner cannot mutate sources/rules/rates/platform roles; platform admin can; self-escalation fails |
| P0 | migration/backfill verification | migration integration | fresh schema and pre-0026 fixture both reach identical constraints; orphan/mismatched parent rows abort safely |
| P1 | multi-org context | Playwright E2E | switching organization changes all lists/counts; stale tab mutation is rejected; header/cookie spoofing grants nothing |
| P1 | runtime workload integration | integration | duplicate enqueue is idempotent; conflict is explicit; retryable/non-retryable failures diverge; replay preserves evidence |
| P1 | AI controls | integration + eval | hard budget blocks before network; usage is tenant-scoped; timeout records SLO; prompt output uses only supplied evidence and keeps safety caveats |
| P1 | export end-to-end | Playwright E2E | missing verified data blocks calculation/approval; verified documents unlock approval; PDF evidence hash matches result |
| P1 | maintenance absence | integration | stale heartbeat opens one actionable alert, recovery resolves it, repeated healthy runs do not inflate incidents |
| P1 | scale/load | load + query-plan | target listing/job volumes remain within declared p95/p99 and no queue starvation/long retention lock occurs |
| P1 | backup restore | disaster-recovery acceptance | isolated restore meets declared RPO/RTO; record counts/hashes and critical user flow pass after restore |
| P2 | accessibility/responsive | Playwright + axe/visual | keyboard, announcements, focus, 200% zoom and 375/768/desktop themes pass on critical routes |

### Engineering implementation sequence

1. Inventory and classify every table, function, route, service and bucket; freeze the tenant-private/shared/governed matrix as an architecture decision record.
2. Add platform-admin authority and a canonical organization-context service without changing existing data yet.
3. Build and test `0026` backfill/RLS/storage isolation in a cloned staging database; include parent-child organization constraints and rollback evidence.
4. Update generated types and all tenant-private services/routes to require organization context; remove global role authorization from business paths.
5. Run the full two-tenant database/API/Storage/E2E matrix before enabling a second production tenant.
6. Wire connector, AI and export external work into operation jobs, SLOs, atomic budgets and rate limits.
7. Add maintenance heartbeat, exact console aggregates and resolved alert transitions.
8. Reconcile migration history, run fresh-environment deploy, load tests and real backup-restore acceptance.

### Engineering review scores

| Dimension | Score | Finding |
|---|---:|---|
| Layer boundaries | 8/10 | Clear modular domains and deterministic cores; shared versus tenant data needs formalization. |
| Data integrity | 6/10 | Strong hashes/state checks in new layers; cross-tenant parent invariants are absent in legacy graph. |
| Security/isolation | 3/10 | Operations is tenant-scoped, core commercial data and Storage are not. |
| Reliability | 7/10 | Queue/replay/retention foundation is strong; workloads and heartbeat are not fully connected. |
| Observability | 6/10 | Correlation/events/SLO schema exists; external calls are not consistently instrumented. |
| Performance readiness | 4/10 | Good index direction, no representative load/query-plan evidence. |
| Test confidence | 6/10 | Strong unit and targeted live acceptance; multi-tenant, full E2E, eval, load and restore coverage missing. |
| Deploy reproducibility | 4/10 | Manual SQL success is useful but migration ledger/staging/release state remains unproven. |

### Engineering completion summary

**Verdict: the modular architecture is viable, but `0026` tenant isolation is the next mandatory implementation unit.** It must classify shared and private data instead of mechanically stamping every table. The following unit is platform/org authority separation and tenant-scoped Storage. Only after adversarial two-tenant acceptance should core workloads be moved onto the new operations runtime. No application or migration code was changed during this review.

## Phase 3.5 — Developer experience and operational onboarding review

### Developer persona card

| Attribute | Primary persona |
|---|---|
| Role | Vehigo product/platform engineer and on-call owner |
| Goal | Move a reviewed change from clean clone to isolated staging, prove the six-layer flow, then deploy without schema or secret drift |
| Context | TypeScript/Next.js/Postgres competent; may not know Vehigo's domain constraints or manual Supabase history |
| Trust need | One canonical command path, explicit environment validation, deterministic migrations and actionable failures |
| Failure cost | Cross-tenant leakage, bad export evidence, silent scheduler failure or an unrecoverable production migration |

### Developer empathy narrative

> I clone Vehigo and understand the product quickly, but the path from `npm install` to a trustworthy environment branches immediately. I must create a remote Supabase project, copy secrets, manually apply up to 25 SQL files or infer how `supabase db push` is configured, create a user in the dashboard, and remember which live acceptance scripts to run. If a variable is missing, I usually discover it when a route or provider call fails. I can run unit tests fast, but I cannot prove that my schema matches production, that migrations are recorded, or that a new tenant is isolated from the old one with a single command.

### Competitive DX benchmark

The appropriate benchmark is a mature private full-stack product repository, not a public SDK. A strong repository provides a pinned runtime, one local/staging bootstrap, schema-history checks, typed environment validation, a single verification command and copy-paste deployment/rollback runbooks.

| Capability | Mature target | Vehigo now | Post-closure target |
|---|---|---|---|
| Time to first meaningful app | <10 min with local dependencies | >30 min and external dashboard work | <15 min local/staging bootstrap |
| Environment setup | generated/validated template | example exists but is incomplete and unchecked | typed validator with optional/required-by-mode groups |
| Database bootstrap | one command, tracked history | manual SQL Editor or unspecified CLI path | local Supabase + `db reset`; staging link/push/checksum workflow |
| Test entrypoint | one preflight/CI-equivalent command | separate lint, type, unit, E2E and live scripts | `verify:local`, `verify:staging`, `verify:release` |
| Failures | code, cause, fix, docs link | mixed raw/generic exceptions | structured errors and runbook anchors |
| Deployment | staged, observable, reversible | workflow files plus manual secrets | environment matrix, smoke, heartbeat, canary and forward-fix plan |

### Magical moment specification

The DX “it works” moment should be one command that ends with a trustworthy six-layer receipt, not merely a running homepage:

```text
npm run verify:staging

✓ environment and remote project identity validated
✓ migrations 0001..0026 recorded in order; generated types match
✓ two-tenant database and Storage isolation passed
✓ permitted fixture -> ingest -> normalize -> search -> intelligence -> export passed
✓ operation lease/retry/heartbeat controls passed
Receipt: .artifacts/verify-staging-<timestamp>.json
```

Real provider/source/export/restore checks remain separate explicit acceptance gates and must state `SKIPPED: missing verified dependency`, never appear green by omission.

### What already exists

- A concise README with architecture links, setup steps, commands, endpoint behavior and environment secret list.
- `.env.local.example` and a deliberately isolated `.env.test.local.example` with a production-project warning.
- Fast unit tests, watch mode, Playwright configuration and a pre-E2E safety script.
- Live verification scripts for queue runtime, operational controls and maintenance/recovery behavior.
- A recovery runbook that prohibits logging service-role secrets and requires forward migrations.
- GitHub workflows for scanner and maintenance scheduling.
- Generated Supabase TypeScript types and strict TypeScript build/lint commands.

### NOT in scope for DX closure

- A public SDK portal, public community, external plugin marketplace or free-tier onboarding; Vehigo is currently a private product repository.
- Supporting every package manager and operating system before Linux CI and the primary macOS workflow are reproducible.
- One-click production mutation from a laptop.
- Hiding real source, customs, backup or provider dependencies behind mocks in release acceptance.

### Developer journey map

| Stage | Current experience | Friction | Closure |
|---|---|---|---|
| 1. Discover | README links several architecture documents | status statements can conflict or lag | one docs index plus generated/current capability matrix |
| 2. Install | `npm install` | Node/npm versions are not pinned | `.nvmrc`/engines and clean-install CI |
| 3. Configure | copy `.env.local.example` | example omits variables used by code and has no validation | typed mode-aware env schema and `env:check` |
| 4. Bootstrap DB | SQL Editor or `db push` | no canonical local config/seed/history path | checked-in Supabase config, seed and reset/link/push scripts |
| 5. First run | `npm run dev` | remote Auth user must be created manually | deterministic local/staging bootstrap user fixture |
| 6. Verify | several commands/scripts | no single CI-equivalent receipt | tiered verification commands with explicit skips |
| 7. Debug | errors vary by route/service | missing code/cause/fix/doc correlation | structured error envelope and verbose/correlation lookup |
| 8. Deploy | workflow and README secret list | no environment matrix, migration gate or post-deploy smoke | staging-first release checklist and automated smoke/heartbeat |
| 9. Recover/upgrade | operations runbook exists | schema rollback/history and release versioning are incomplete | forward-fix migration guide, changelog and restore/canary evidence |

### Pass 1 — Getting started: 3/10

A developer cannot reach a meaningful end-to-end result in one terminal session under ten minutes. The SQL Editor and dashboard-created user steps are the largest blockers. The ideal primary path is:

1. `npm ci && npm run bootstrap:local` — validate pinned tooling, start/reset local Supabase, seed two tenants and safe fixtures.
2. `npm run dev` — print app URL plus fixture accounts and current schema version.
3. `npm run verify:local` — run type/lint/unit/database isolation/core E2E and print a receipt.

External staging and real-dependency verification follow after local confidence, not before it.

### Pass 2 — API/CLI/SDK design: 6/10

HTTP route names and service boundaries are generally guessable. Scanner authorization varies between bearer and `x-scanner-secret`, organization selection varies between implicit first membership and `x-organization-id`, and live verification scripts are not exposed as stable package commands. Standardize request context, structured response errors, pagination and operational command naming. Add `--dry-run`, `--json` and non-interactive exit codes to destructive or acceptance scripts.

### Pass 3 — Errors and debugging: 5/10

| Path | Current developer signal | Required signal |
|---|---|---|
| Missing environment/model | route-time skip, generic failure or provider HTTP status | startup/preflight error code, missing variable, mode, exact fix and docs anchor |
| Migration mismatch | SQL Editor error or runtime missing relation/column | expected/applied migration list, project identity, checksum drift and safe repair command |
| Tenant/owner rejection | localized exception or redirect | stable `organization_*` error code, selected tenant, required role and safe navigation/fix |
| Maintenance failure | HTTP 500 plus workflow log | correlation ID, failed maintenance stage, heartbeat age and runbook link |

Application errors should remain user-safe while server/CLI output carries structured `code`, `message`, `cause`, `action`, `correlation_id` and `docs_path`. Debug mode must redact secrets and tenant payloads.

### Pass 4 — Documentation and learning: 6/10

The repository has useful architecture, roadmap and recovery documents, but README is carrying setup, product behavior, endpoint reference and production operations at once. There is no canonical docs index, generated schema/API reference, verified command output or clear “current versus planned” badge. Split into quickstart, local development, architecture decisions, API/operations reference and production runbooks. CI should execute documented commands and detect stale migration/type references.

### Pass 5 — Upgrade and migration path: 3/10

There is no changelog/version policy, migration checksum/history gate, staging promotion procedure or per-breaking-change guide. Manual application of `0015`–`0025` increases drift risk. Adopt forward-only migrations, immutable applied files, `supabase migration list` reconciliation, a fresh reset test, pre-production backup, expand/backfill/contract sequence and an explicit rollback/forward-fix decision record for every risky migration.

### Pass 6 — Developer environment and tooling: 5/10

TypeScript, lint, Vitest, Playwright and hot reload are present. Missing pieces are pinned Node/npm versions, checked-in local Supabase configuration/seed, CI that runs the complete local gate, generated-type drift checking, mode-aware environment validation and cleanup of macOS `._*` metadata/test-result artifacts. The environment example omits `OPENAI_MARKET_MODEL`, input/output pricing variables and any damage-model setting used by the code.

### Pass 7 — Community and ecosystem: 4/10, non-blocking for private launch

There is no license, contribution guide, ownership map, issue template or support/escalation channel. Public community investment is unnecessary now, but internal ownership is not: add CODEOWNERS, security/contact policy and incident/architecture decision ownership before more engineers or partners join.

### Pass 8 — DX measurement and feedback: 2/10

No time-to-hello-world measurement, bootstrap telemetry, documented friction log or recurring onboarding test exists. Add a clean-environment CI job, record setup/verification duration, require a quarterly new-developer dry run and turn failed preflight codes into an internal friction dashboard without sending source or secrets externally.

### First-time developer confusion report

1. **Which database path is canonical?** README offers SQL Editor and `db push` without checked-in local Supabase workflow. Address with one primary path and one documented recovery path.
2. **Did SQL Editor register my migrations?** Not knowable from current instructions. Address with migration-ledger reconciliation before further schema work.
3. **Which environment variables are really required?** The example and code disagree. Address with executable validation derived from one schema.
4. **Which tests prove production readiness?** Unit, E2E and three live scripts are separate. Address with tiered verification commands and receipts.
5. **Can I safely use my production project?** E2E warns against it, but other scripts select the default organization and can mutate live data. Address with project allowlists, explicit confirmation and dry-run modes.
6. **What is implemented versus environment-dependent?** Roadmap and README contain status prose in several places. Address with one generated capability/evidence matrix.

### DX implementation tasks

- [ ] **DX1 (P1)** — Add pinned runtime plus typed, mode-aware environment validation; make build, server and scripts share it.
- [ ] **DX2 (P1)** — Check in local Supabase config/seed and canonical `bootstrap:local`, `db:reset`, `db:status` commands.
- [ ] **DX3 (P1)** — Reconcile migration history and add fresh-reset/checksum/generated-type drift gates to CI.
- [ ] **DX4 (P1)** — Add `verify:local`, `verify:staging` and `verify:release` orchestration with machine-readable receipts and explicit skips.
- [ ] **DX5 (P1)** — Protect live scripts with project identity allowlists, dry-run mode, non-interactive flags and clear mutation summaries.
- [ ] **DX6 (P2)** — Split README into quickstart/docs index and focused runbooks; add verified outputs and current/evidence status.
- [ ] **DX7 (P2)** — Standardize API/CLI error envelopes with codes, fixes, correlation IDs and documentation anchors.
- [ ] **DX8 (P2)** — Add changelog, forward-migration/release guide, CODEOWNERS and security/support ownership.
- [ ] **DX9 (P2)** — Add clean-environment onboarding CI and track bootstrap/verification duration over time.

### DX scorecard

| Dimension | Score | Launch impact |
|---|---:|---|
| Getting started | 3/10 | blocking for repeatable engineering and staging |
| API/CLI consistency | 6/10 | usable, context/auth/error conventions need convergence |
| Error messages | 5/10 | diagnosis depends too much on source inspection |
| Documentation | 6/10 | useful content, weak information ownership/current-state signal |
| Upgrade path | 3/10 | blocking for safe schema evolution |
| Developer environment | 5/10 | good tools, incomplete reproducibility |
| Community/ownership | 4/10 | public community deferred; internal ownership needed |
| DX measurement | 2/10 | no feedback loop or clean-room evidence |
| **Overall** | **4.3/10** | **critical DX debt before team/production scale** |

Estimated current time to a trustworthy first result is over 30 minutes and includes external UI work. The closure target is under 15 minutes for local verification and one documented command for staging verification.

### DX completion summary

**Verdict: local coding is comfortable, environment-to-release reproducibility is not.** Before treating Vehigo as a real production product, the project needs one database bootstrap path, executable environment validation, migration/type drift gates, tiered verification receipts and safe live-script controls. Public SDK/community work is intentionally deferred. No runtime or setup code was changed during this review.

## Phase 4 — Unified production closure plan

### Six-layer compatibility score

These are evidence-weighted review scores, not automated coverage percentages. “Architecture alignment” measures whether the right boundaries and mechanisms exist in the repository. “Launch evidence” measures whether real dependencies, isolation, scale, recovery and deployment have been proven.

| Layer | Architecture alignment | Launch evidence | Status | Main gap |
|---|---:|---:|---|---|
| 1. Source | 7/10 | 3/10 | code-ready, corridor-blocked | per-source permission/acquisition evidence and sustainable real coverage |
| 2. Connector | 8/10 | 5/10 | strong foundation | more real adapters, provider controls and load/failure proof |
| 3. Normalization | 8/10 | 6/10 | strongest layer | taxonomy/alias governance, drift metrics and representative-volume proof |
| 4. Search | 8/10 | 6/10 | E2E foundation verified | coverage/freshness UX, query-plan/load evidence and source-outage E2E |
| 5. AI/intelligence | 7/10 | 3/10 | guarded but incomplete | tenant budget/SLO wiring, eval suite, explicit production model/pricing config |
| 6. Export | 8/10 | 3/10 | deterministic engine, no real corridor proof | verified rule/rate/document data and full approval/PDF acceptance |
| Cross-cutting operations | 8/10 | 7/10 | acceptance-verified control plane | full tenant graph, deployed heartbeat, restore and deployment proof |
| **Overall** | **7.7/10** | **4.7/10** | **architecture compatible; production launch blocked** | tenant isolation plus real corridor/restore/load evidence |

### Definition of production-ready

Vehigo is ready for a controlled production launch only when all of the following are evidenced:

- Two real organizations pass database, API and Storage isolation tests across the full tenant-private graph.
- Platform-admin and organization-owner permissions are separate and self-escalation is impossible.
- One source-to-destination commercial corridor has documented source permission, live connector acquisition, verified export rules, current rate provenance and required document definitions.
- Search, deterministic intelligence, optional AI review, export approval and evidence PDF complete end to end for that corridor.
- External calls consume organization budgets/rate limits and emit SLO/correlation evidence.
- Maintenance heartbeat, alert delivery and scheduler smoke tests pass in the deployed environment.
- Representative load tests meet declared latency/queue budgets.
- A real isolated backup restore meets declared RPO/RTO and passes post-restore integrity/smoke checks.
- Fresh staging deployment reproduces migration history, generated types, environment validation and release verification from repository commands.
- Critical UI routes pass recovery, accessibility, keyboard, responsive and partial-data acceptance.

### Delivery sequence

| Wave | Scope | Exit gate | Dependency |
|---|---|---|---|
| 0. Release baseline | preserve current work, reconcile `0015`–`0025` remote history, capture schema/data backup, create clean staging clone, pin runtime | fresh staging applies recorded migrations and generated types match | none |
| 1. Tenant safety (`0026`) | data-classification ADR, platform-admin authority, selected organization context, tenant ownership/backfill, parent-child constraints, RLS and Storage prefix migration | full two-tenant DB/API/Storage matrix passes; no global business-owner policy remains | Wave 0 |
| 2. Runtime integration | connector jobs, AI jobs/budgets/SLOs, export async work, exact operation aggregates, maintenance heartbeat and alert transitions | failure/retry/replay/budget/SLO/heartbeat E2E passes by tenant | Wave 1 |
| 3. First real corridor | one permitted source, one destination route, sourced rule set, current rate snapshot, document requirements and human approval | real listing -> normalized search -> intelligence -> landed cost -> approval/PDF receipt | Waves 1–2 and external evidence |
| 4. Production proof | load/query plans, security review, retention/offboarding, secret rotation, real backup restore, deployment smoke/canary | signed launch evidence pack with p95/p99, RPO/RTO and deployed heartbeat | Waves 1–3 |
| 5. Product quality | tenant switcher, coverage/trust/recovery components, route boundaries, accessibility/responsive gates, docs/bootstrap/verification commands | critical-route QA and clean-room developer onboarding pass | can start in Wave 1; final gate after Wave 4 |
| 6. Controlled launch | limited organizations, explicit support/on-call owner, canary monitoring, incident review and rollback/forward-fix criteria | launch window closes without P0/P1; evidence archived | all previous waves |

### First implementation package: Wave 0 and `0026` design

Do not paste a new `0026` directly into production. The safe first package is:

1. Capture remote migration status and an immutable pre-change schema snapshot without exposing secrets.
2. Create an isolated staging clone or separate Supabase project and prove `0001`–`0025` from a clean state.
3. Write the data-classification/authority ADR and enumerate every affected table, foreign key, policy, function, bucket and service.
4. Implement `0026` as expand/backfill/validate/enforce steps that are retry-safe where possible.
5. Regenerate types and require organization context in services/routes.
6. Run the two-tenant denial matrix and Storage object-path migration against staging data.
7. Review the staging evidence and backup/forward-fix procedure before scheduling production application.

### Work ownership

| Owner | Responsibility |
|---|---|
| Product/platform engineering | migrations, service context, runtime integration, tests, deployment automation |
| Security reviewer | tenant/Storage/authority matrix, secret handling, retention/offboarding |
| Product owner/operator | verified source permission, export source references, document definitions, launch corridor acceptance |
| Infrastructure owner | staging/production separation, backups/PITR, scheduler, monitoring, restore evidence |
| Design/QA | degraded states, accessibility, responsive and end-to-end operator flows |

One person may hold several roles, but the evidence and approval responsibilities remain separate.

### Risks that cannot be solved by code alone

- Marketplace permission, API/feed/email access and usage terms.
- Customs/tax/export rule correctness and the authority/date of each source.
- Exchange-rate source policy and observation frequency.
- Legal retention, deletion, sanctions/compliance and customer contract requirements.
- Supabase backup/PITR configuration and the actual restore mechanism available on the selected plan.
- Operational on-call ownership, incident communication and acceptable commercial downtime.

### Final decision gate

The review recommends approval of the closure plan and starting with **Wave 0 followed by the staged `0026` tenant-safety package**. This approval authorizes implementation planning and repository changes inside that package; it does not authorize applying `0026` to production until staging, backup and two-tenant evidence pass.

## GSTACK REVIEW REPORT

**Status: DONE_WITH_CONCERNS**

- CEO/product: architecture direction approved; production launch rejected until launch gates close.
- Design: current visual system approved; tenant context, trust/coverage and rescue states required.
- Engineering: modular monolith approved; tenant-private RLS/Storage and authority separation are P0.
- DX: local tooling is useful; environment, migration and release reproducibility are below product standard.
- Independent voice: unavailable. The subagent produced no usable review, and the external Codex path was blocked by the privacy/security reviewer because it would transmit private repository content.
- Artifacts: this review and `docs/final-production-readiness-test-plan.md` contain the executable closure and QA plans.
- Recommended next action: approve Wave 0 + staged `0026`; then implement and verify one gate at a time.

Production evidence run, 2026-07-14:

- Static evidence receipt passed: 25 contiguous migrations, environment-key coverage and required workflow/runbook artifacts.
- Full local receipt passed: 21 test files/101 tests, lint, TypeScript and Next.js production build.
- Development environment contract passed without printing secrets.
- Local clean database reset is blocked because no Docker-compatible container runtime is installed.
- Isolated `vehigo-e2e` drift was repaired through `0015`–`0025`; 12/12 required application schema capabilities now pass. Direct REST visibility of the internal duplicate-cluster table remains a tracked warning while its FK and consuming flows pass.
- E2E project identity and destructive-cleanup safety pass; organization context is provisioned idempotently.
- Standard Playwright gate passes 2/2: dealer vehicle → lead → match → offer → compliance → PDF, plus alert vehicle-filter behavior.
- Queue runtime acceptance passes idempotency, atomic claim, heartbeat, success, dead-letter, attempt and event evidence.
- Control acceptance passes rate limit, hard budget, provider SLO and alert severity behavior.
- Maintenance acceptance passes expired-lease recovery, retention scrubbing, provider-observation expiry, evidence-gated drill lifecycle, failed-drill critical alert and non-owner rejection.
- Production evidence score is now 4.7/10. Remaining score is gated by the full tenant-private graph, real source/export corridor, deployed heartbeat, load/query plans, real backup restore and release/canary proof.
- The final receipt rerun was blocked by the Codex elevated-command usage limit after the env namespace checker was corrected. Post-correction lint, TypeScript and diff checks pass; the immediately preceding run completed 101 tests and production build successfully.

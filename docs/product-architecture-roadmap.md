# Vehigo Product Architecture Roadmap

## Product objective

Vehigo is a multi-source European vehicle intelligence and export decision platform. It must discover listings, preserve source evidence, normalize every source into one canonical vehicle language, search across countries, explain commercial risk, and calculate destination-specific landed cost without hiding uncertainty.

The target is a production product, not a demo crawler. Every automated conclusion must be traceable to source data, a normalization rule, a market comparison, or a versioned export rule.

## Six-layer target architecture

```text
Source catalog
  -> Connector runtime
    -> Canonical normalization
      -> Search and ranking
        -> AI decision support
          -> Export and landed-cost engine
```

### 1. Source catalog

Owns marketplace identity, countries, acquisition methods, legal/technical constraints, supported vehicle types, connector version, health, and scheduling policy. A source record is configuration; it is not a connector implementation.

### 2. Connector runtime

Each connector publishes a versioned manifest and returns the same raw listing contract. Direct API, HTML, saved-search email, partner feed, and web-index discovery are separate capabilities. The runtime enforces timeouts, bounded concurrency, retries, leases, observability, and source URL integrity.

### 3. Canonical normalization

Converts source fields into a canonical listing. It owns brand/model aliases, taxonomy, units, currency codes, localized terminology, evidence, confidence, validation warnings, and a cross-source fingerprint. Raw source payloads remain immutable evidence.

### 4. Search and ranking

Compiles structured filters or natural language into a versioned search plan. It searches the local listing index immediately and schedules remote connector work when freshness or coverage requires it. Results are deduplicated, ranked, explainable, and explicit about missing data.

### 5. AI decision support

Uses deterministic calculations first and AI only where judgment adds value. Initial tools are comparable-market analysis, anomaly/risk review, listing summarization, and natural-language query parsing. Every answer includes evidence, confidence, model/version, cost, and a human-review state.

### 6. Export and landed-cost engine

Calculates versioned, destination-specific acquisition and landed cost. Rules are effective-dated and cover transport, insurance, duties, VAT/tax, registration, documents, service fees, commission, currency conversion, and compliance gates. A quote stores the exact rule and exchange-rate versions used.

## Non-negotiable product rules

1. Raw source evidence is never overwritten by normalized or AI-generated data.
2. Unknown values remain unknown. Search may offer strict or discovery mode, but never silently invent a match.
3. Connector failures are isolated by source and are observable.
4. Cross-source duplicates are clustered without deleting source-specific listings.
5. AI cannot approve compliance, identity, payment, or export legality.
6. Export calculations are reproducible from stored rule versions and inputs.
7. Database changes are additive first, backfilled, then enforced in a later migration.
8. Every phase ships with unit, integration, and user-path verification.

## Delivery phases

Delivery status: Phase 1, Phase 2, and Phase 3 are implemented in the repository. Database migrations `0015`, `0016`, and `0017` must be applied in order before deploying the corresponding application code.

### Phase 1: Canonical data foundation

- Versioned canonical listing contract.
- Dedicated normalization module with aliases and localized value parsing.
- Connector manifest/capability contract.
- Additive database columns for canonical fields, provenance, confidence, and fingerprints.
- Existing Marktplaats, Brave, email, and n8n ingest paths normalize before persistence.
- Contract and normalization tests.

Exit criteria: all incoming paths persist canonical version 1 fields without breaking existing scanner behavior.

### Phase 2: Source and connector platform

- Source catalog gains countries, vehicle coverage, acquisition capabilities, compliance notes, and connector version.
- Connector registry is separated from the scanner runner.
- Per-source contract fixtures and health checks.
- First-party connectors are added only where API, feed, saved search, or permitted HTML access is sustainable.
- Dead-letter/replay flow for rejected ingest payloads.

Exit criteria: adding a connector requires no changes to scanner orchestration and includes a repeatable contract test.

Implemented foundation:

- Runtime connector registry and versioned manifests.
- Per-connector checked-in contract fixtures.
- Catalog/runtime drift detection and synchronization endpoint.
- Constant-time scanner credential comparison and bounded JSON bodies.
- Durable idempotent ingest event lifecycle with rejected/failed states.
- Automatic retry with a bounded attempt count, dead-letter visibility, manual replay, and payload retention cleanup.

### Phase 3: Search engine

- Dedicated indexed watchlist columns replace encoded keyword metadata.
- Multi-country selection, EU/EEA/Schengen/Balkans presets, and radius search.
- Search planner, freshness policy, pagination, stable sorting, and strict/discovery modes.
- Cross-source duplicate clusters and a single result card with source alternatives.
- Natural-language query parser with a user-confirmable structured plan.

Exit criteria: one query can search multiple countries and sources, return explainable deduplicated results, and refine conversationally.

Implemented foundation:

- Dedicated indexed watchlist filter columns with additive legacy-token backfill.
- Multi-country selection plus EU, EEA, Schengen, Balkans, and coordinate/radius geography.
- Explainable strict/discovery evaluation that preserves unknown values without inventing matches.
- Versioned deterministic multilingual natural-language planner with explicit user confirmation.
- Freshness policy, bounded pagination, configurable sorting, and deterministic tie-breaking.
- Persistent canonical-fingerprint duplicate clusters that keep every source listing and expose alternatives on one result card.
- Authenticated search-plan and deduplicated listing-search endpoints.

### Phase 4: Market intelligence and AI

- Comparable selection based on canonical taxonomy, year, mileage, specification, and geography.
- Price distribution and market-underpricing calculation with sample-quality thresholds.
- Risk/anomaly signals, listing age, price history, and seller signals.
- Image-assisted damage review when images and usage rights are available.
- AI evaluation ledger with evidence, prompt/model version, cost, confidence, and human decision.

Exit criteria: commercial claims are reproducible and never shown without data-quality context.

Implemented foundation:

- Versioned, hash-addressed intelligence snapshots that preserve selected comparable IDs and exclusion evidence.
- Canonical brand/model, year, mileage, specification, geography, currency, and duplicate-cluster-aware comparable scoring.
- Quartile/median price distribution with independent-source and sample-quality gates; underpricing claims require medium or high quality.
- Deterministic listing-age, price-history, normalization, missing-fact, declared-damage, suspicious-payment, and seller-observation risk signals.
- Rights registry that prevents image analysis unless source, partner, or user authorization is explicitly recorded.
- Dedicated AI ledger with evidence hash, prompt/model version, token/cost accounting, confidence, failure/skip status, and human decision fields.
- Authenticated analysis and human-decision APIs plus data-quality-aware intelligence cards in the opportunity flow.
- Telegram arbitrage publishing now consumes the same reproducible snapshot and blocks weak samples or critical risk.

### Phase 5: Export engine

- Destination, origin, route, vehicle category, and buyer profile become explicit inputs.
- Versioned rule tables and exchange-rate snapshots.
- Iran implementation is migrated from manual fields to the generic rule engine.
- Scenario comparison, sensitivity analysis, document checklist, and compliance approvals.
- Quote/PDF records the exact calculation snapshot.

Exit criteria: the same vehicle can produce reproducible landed-cost scenarios for supported destinations.

Implemented foundation:

- Explicit origin, destination, transport mode, route, vehicle category, buyer profile, vehicle price/currency, and calculation currency inputs.
- Versioned and owner-approved rule sets with effective dates, source references, conditions, required documents, and fixed/percentage rules.
- Immutable exchange-rate snapshots with provider, source reference, observation time, and optional expiry.
- Deterministic `landed-cost-v1` engine with ordered cost lines, currency conversion, customs-value/subtotal bases, min/max bounds, and evidence requirements.
- Baseline plus FX, logistics, vehicle-price, and combined stress sensitivity scenarios.
- Hash-addressed calculation results that preserve input, rule, FX, cost-line, total, sensitivity, and compliance snapshots.
- Generic migration path from legacy Iran-specific offer fields into normal cost categories without deleting or rewriting the original offer.
- Required-document workflow, calculation blockers, human approval, and approved-result linkage back to offers.
- Offer PDF embeds the exact approved landed-cost evidence hash, calculation/rule version, route, FX snapshot, and total.
- Authenticated scenario, calculation, approval, document, exchange-rate, rule-set, and legacy-offer conversion APIs plus a responsive comparison workspace.

### Phase 6: Product operations

- Queue-based background execution, idempotency keys, retry policy, dead-letter handling, and replay.
- Structured logs, traces, source SLOs, alerts, usage/cost budgets, backups, and recovery drills.
- Role and organization isolation, audit coverage, retention controls, and rate limits.
- Admin source/connector operations console.

Exit criteria: one source or provider failure cannot stop unrelated work and operators can diagnose/replay failures.

Implementation in progress:

- Organization and active-membership foundation with a safe default-organization backfill.
- Organization-scoped audit visibility replacing the previous global authenticated read policy.
- Generic versioned operation jobs with payload hashes, idempotency keys, priorities, availability, retention, correlation IDs, and parent-job lineage.
- Atomic `SKIP LOCKED` worker claims, bounded leases, heartbeats, attempt history, exponential retry, expired-lease recovery, dead-letter state, and owner replay.
- Structured operation events and service-role-only retention cleanup primitives.
- Organization-aware scanner ingest registration, owner-only job listing/overview/replay APIs, and last-owner-safe membership role management.
- Provider SLO observations and breach alerts, atomic soft/hard usage budgets, fixed-window rate limits, recovery-drill evidence, and retention cleanup controls.

### Phase 7: Product experience and launch quality

- Map and list search, saved views, comparison workspace, decision timeline, and mobile-responsive workflows.
- Accessibility, localization, empty/error/loading states, and performance budgets.
- End-to-end coverage for discovery through approved quote.
- Production readiness review, security review, load tests, and staged rollout.

Exit criteria: the complete core journey works under realistic data volume, provider failure, and slow-network conditions.

## Dependency order

```text
Phase 1 Canonical data
  -> Phase 2 Connector platform
  -> Phase 3 Search engine
       -> Phase 4 AI intelligence
       -> Phase 5 Export engine
            -> Phase 6 Operations
                 -> Phase 7 Launch quality
```

AI and export work depend on canonical, trustworthy vehicle data. Operations hardening begins in every phase, while Phase 6 completes the shared runtime and production controls.

## Phase 1 acceptance criteria

1. `MarketListingInput` supports the canonical v1 vehicle fields without making existing connector payloads invalid.
2. Brand aliases such as `VW` and `Mercedes Benz` normalize deterministically.
3. Localized fuel, transmission, condition, seller type, and country values normalize where evidence exists.
4. A normalization result contains schema version, confidence, warnings, normalized fields, and a deterministic fingerprint.
5. Every listing is normalized exactly once at the persistence boundary, independent of discovery channel.
6. Existing source-specific raw payload is retained.
7. Connector manifests declare version, countries, acquisition modes, vehicle coverage, and field coverage.
8. Migration is additive, indexed, and safe for existing rows.
9. Existing tests remain green and new normalization/connector contract tests pass.
10. TypeScript, lint, and production build succeed.
Implementation status: queue/lease/retry/dead-letter runtime, organization-scoped authorization/audit, structured correlation events, SLO/budget/rate-limit controls and the owner operations console are operational. Migration `0025` adds scheduled retention/lease maintenance plus evidence-gated recovery drill completion; deployment scheduling and a live restore drill remain environment acceptance steps.

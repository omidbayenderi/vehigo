# Vehigo tenant data classification

Status: accepted for migration `0026`  
Scope: database RLS, parent/child integrity, platform governance, and Supabase Storage

## Classification

| Class | Data | Read authority | Write authority |
| --- | --- | --- | --- |
| Tenant-private | Vehicles and images, leads and activity, matches, offers and compliance, message drafts | Active organization members | Organization role policy |
| Tenant-private | Watchlists, listing alerts, purchase checklists | Active organization members | Owning user or organization broker/owner |
| Tenant-private | AI evaluations and export scenarios/results/documents | Active organization members | Organization broker/owner; approval requires organization owner |
| Shared catalog | Market sources, normalized listings, price history, duplicate clusters, intelligence snapshots | Authenticated product users | Trusted service runtime |
| Governed reference | Media rights, export routes, rule sets/rules, exchange-rate snapshots | Authenticated product users | Explicit platform admin only |
| Organization operations | Jobs, attempts, events, alerts, budgets, rate limits, recovery drills, audit and ingest events | Existing organization RLS | Existing organization/service policies |

## Decisions

- Every tenant-private row carries a non-null `organization_id`, including child rows. RLS can therefore be audited without relying on a long join chain.
- Composite foreign keys enforce that a child and its tenant-private parent belong to the same organization.
- Existing rows are backfilled to `vehigo-default` before constraints are enforced. This is the explicit single-tenant-to-multi-tenant transition rule.
- A user has an `active_organization_id`. New tenant rows use it as their database default; `set_active_organization` validates membership before switching it.
- `platform_admins` is independent of `organization_members.role = 'owner'`. Migration `0026` bootstraps legacy owners once, but future organization owners do not become platform administrators.
- New Storage keys use `<organization-uuid>/...`. Legacy keys are readable only when a tenant-visible database row references the exact key.
- The application still treats RLS as the final authority. Passing an organization ID from a client is never sufficient authorization.

## Rollout gate

1. Apply `0026` to the disposable `vehigo-e2e` project first.
2. Run schema capability checks and the standard E2E suite.
3. Run the two-user/two-organization adversarial DB/API/Storage acceptance gate.
4. Apply to the main project only after the adversarial gate passes and a current backup/restore point is recorded.

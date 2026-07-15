# Changelog

All notable changes to Vehigo are documented in this file.

## [0.2.0.0] - 2026-07-15

### Added

- Added one independently scheduled search agent per supported European marketplace, with localized queries that apply vehicle, geography and detailed watchlist criteria.
- Added durable agent leases, request budgets, cursor rotation, run ledgers and per-site failure isolation for reliable scheduled discovery.
- Added append-only provider storage-rights evidence and explicit operator activation so indexed results cannot be stored without a current verified agreement.
- Added concurrency-safe twice-daily Telegram opportunity digests with fenced claims and uncertain-delivery quarantine.
- Added production acceptance scripts, schema capability checks and regression coverage for the site-agent fleet.

### Changed

- Changed indexed listing discovery to canonicalize marketplace URLs, remove tracking parameters and reject unsafe or cross-host links before storage.
- Changed scanner health responses to report replay, maintenance, required-source and agent failures as degraded service.
- Changed manual global scanning so only platform administrators can start it.
- Changed the scanner schedule and execution limits to match fleet capacity while preserving provider budgets.

### Fixed

- Fixed audit logging for manual scanner runs so command labels are no longer written into UUID fields.
- Fixed malformed indexed results so one rejected listing cannot replay or discard the rest of a valid batch.
- Fixed duplicate Telegram delivery races and removed immediate Telegram sends from the ingestion path.
- Fixed migration 0027 so an interrupted older attempt is reconciled and can be safely rerun in the Supabase SQL Editor.

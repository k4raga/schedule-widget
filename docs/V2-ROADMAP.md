# schedule-widget v2 Roadmap

## Delivery Model

Ship v2 in bounded vertical slices. Each slice must produce an executable state, clear acceptance criteria, and QA evidence.

## Slice 0: Foundation and Contracts

Scope:

- initialize v2 folder boundaries
- define domain contracts and DTO validation
- establish SQLite schema baseline and migration flow
- define deterministic test fixtures

Acceptance:

- schema migrations run on clean machine
- day fixtures load consistently
- backend can start with no renderer crash

## Slice 1A: UX Parity Shell

Scope:

- restore the `v1` screen rhythm inside live `v2`
- show the full day flow as a believable operational widget
- restore `Прошло`, `Сейчас`, `Текущий слот`, and `Далее` as distinct UX zones
- make taskable slots look and feel actionable, even where some behavior is temporarily stubbed
- preserve the accepted Hacknet-terminal visual guide while inheriting the product UX of `v1`

Acceptance:

- the app visually reads like the old widget again
- active slot is surfaced first in the working area
- top-level flow no longer feels like a simplified shell over a partial slot list
- stubbed surfaces look intentional rather than unfinished

## Slice 1B: Day View Core (No Sync)

Scope:

- implement day projection pipeline
- implement live and browse reference-date semantics
- render slot layout from prepared day-view model
- task CRUD through backend commands

Acceptance:

- startup is stable
- date navigation behaves consistently
- create/edit/delete works in slot and non-slot contexts
- no hidden live-date fallback in browse mode

## Slice 2: Recurring Projection

Scope:

- recurring template persistence
- lazy per-date recurring projection
- slot-kind + exact-time matching
- projection surfaced in day view and edit flows

Acceptance:

- recurring appears on matching eligible dates
- recurring does not appear on non-matching dates
- no persisted infinite future copies
- projected edit updates source template by default

## Slice 3: Codex Local API

Scope:

- local HTTP API mapped to backend domain commands
- strict request validation
- stable responses for task operations and day context

Acceptance:

- external client can create/update/delete tasks deterministically
- invalid payloads return clear validation errors
- API behavior matches documented contracts

## Slice 4: Google Sync Adapter

Scope:

- explicit manual sync action
- adapter maps eligible tasks to Google operations
- store sync runs and per-item outcomes
- user-visible sync result summary

Acceptance:

- sync runs without blocking core UI interactions
- only eligible tasks (`calendarMode = google`) are considered
- success/failure details are observable and auditable

## Slice 5: QA Automation and Hardening

Scope:

- add domain tests for date and recurring logic
- add backend integration tests for task and sync command paths
- add narrow UI smoke scenarios for startup and core interactions
- finalize manager smoke checklist for release gates

Acceptance:

- critical regressions are covered by automated tests
- QA scenario pack is executable and versioned
- manager can make release decisions using test evidence + smoke verdict

## Release Gate

v2 can be declared operational when:

- slices 0 through 5 are complete
- recurring behavior is deterministic and bounded
- browse/live semantics are stable
- local API and sync behaviors are validated
- QA and manager final checks consistently report `works`

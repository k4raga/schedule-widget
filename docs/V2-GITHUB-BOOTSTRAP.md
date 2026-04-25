# schedule-widget v2 GitHub Bootstrap

## Repository Direction

Treat v2 as a controlled rewrite track with explicit boundaries from v1 stabilization work.

Recommended top-level structure:

- `apps/desktop` - Electron shell + renderer for v2
- `packages/domain` - pure task/slot/date/recurring logic
- `packages/backend` - application use-cases + command handlers
- `packages/storage-sqlite` - SQLite schema and repositories
- `packages/adapters` - Watson import, Google sync, API adapters
- `packages/contracts` - shared DTOs and validation schemas
- `tests` - integration and scenario suites
- `docs` - product, architecture, QA, and rollout artifacts

If monorepo overhead is not desired initially, keep one repo but mirror these boundaries in folders from day one.

## Branch Strategy

- `main` - stable accepted line
- `codex/v2-bootstrap` - bootstrap docs and initial project scaffolding
- `codex/v2-slice-*` - bounded feature slices
- `codex/v1-hotfix-*` - emergency v1 fixes only

Rules:

- no direct pushes to `main`
- each PR maps to one bounded board cycle
- do not mix v1 hotfixes and v2 feature work in one PR

## Labels, Epics, and Initial Issues

Recommended labels:

- `area:domain`
- `area:backend`
- `area:renderer`
- `area:storage`
- `area:sync`
- `area:api`
- `area:qa`
- `risk:high`
- `type:bug`
- `type:feature`
- `type:refactor`
- `type:test`

Initial epics:

- `EPIC-V2-FOUNDATION`
- `EPIC-V2-RECURRING`
- `EPIC-V2-CODEX-API`
- `EPIC-V2-GOOGLE-SYNC`
- `EPIC-V2-QA-AUTOMATION`

First issue set:

1. establish SQLite schema and migration baseline
2. implement domain day projection with browse/live semantics
3. implement lazy recurring projection with bounded-date rules
4. wire backend command handlers for task CRUD
5. expose local API through validated domain commands
6. add QA baseline scenarios and first automation pack

## PR Workflow (Manager / Developer / QA)

1. Manager defines bounded scope, acceptance criteria, and assigned scenarios.
2. Developer implements only assigned surface and reports residual risks.
3. QA validates:
- code changes
- runtime behavior against scenarios
- visual sanity for user-facing changes
4. Manager runs final smoke check in simplified verdict format:
- `works`
- `does not work`
5. Manager accepts/rejects and updates board.

## What to Carry from v1

Carry:

- product intent (slot-based day operations)
- local-first operation model
- selective Google sync rule (`calendarMode = google`)
- local API need for Codex integration
- manager/developer/QA operating process

Do not port blindly:

- renderer-owned business logic
- recurring behavior coupled to UI state mutations
- hidden fallback paths that alter semantics
- ad-hoc debug hooks in production paths
- duplicated logic between renderer, sync, and API layers

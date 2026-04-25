# schedule-widget v2 GitHub Labels

This file defines the initial labels and epic mapping for the v2 rewrite workflow.

## Core Label Set

### Area labels

- `area:domain` - pure day/slot/date/recurring logic
- `area:backend` - use-cases, command handlers, orchestration
- `area:renderer` - desktop UI rendering and interaction layer
- `area:storage` - SQLite schema, migration, repositories
- `area:sync` - Google sync adapter and sync reporting
- `area:api` - local HTTP/API contracts for Codex
- `area:qa` - QA cycle setup, scenario coverage, verification

### Type labels

- `type:bug` - defect or regression
- `type:feature` - new capability
- `type:refactor` - structural change without intended behavior change
- `type:test` - test automation or verification harness work

### Risk labels

- `risk:high` - elevated regression risk or broad surface impact

## Epic Labels / Tracking Keys

Use these as GitHub milestones, project fields, or issue prefix keys:

- `EPIC-V2-FOUNDATION`
- `EPIC-V2-RECURRING`
- `EPIC-V2-CODEX-API`
- `EPIC-V2-GOOGLE-SYNC`
- `EPIC-V2-QA-AUTOMATION`

## Manager Usage Rules

1. Every implementation issue should have:
- one `type:*` label
- one or more `area:*` labels
- an epic key in title/body or as milestone mapping

2. Add `risk:high` when:
- recurring semantics change
- browse/live date logic changes
- startup/load/sync behavior changes
- API contract changes

3. For each cycle:
- create one implementation issue (`type:feature` or `type:bug`)
- create one QA verification issue (`area:qa`, `type:test`)
- link both issues in the PR description

4. Do not mix:
- `v1` hotfix scope and `v2` slice scope in one issue/PR

## First Suggested Issue Pack

1. `[Slice] V2 Foundation and contracts`
- labels: `type:feature`, `area:backend`, `area:storage`
- epic: `EPIC-V2-FOUNDATION`

2. `[Slice] Day projection with browse/live semantics`
- labels: `type:feature`, `area:domain`, `area:renderer`
- epic: `EPIC-V2-FOUNDATION`

3. `[Slice] Lazy recurring projection with bounded materialization`
- labels: `type:feature`, `area:domain`, `risk:high`
- epic: `EPIC-V2-RECURRING`

4. `[Slice] Local Codex API command layer`
- labels: `type:feature`, `area:api`, `area:backend`, `risk:high`
- epic: `EPIC-V2-CODEX-API`

5. `[Slice] Google sync adapter and sync run reporting`
- labels: `type:feature`, `area:sync`, `area:backend`, `risk:high`
- epic: `EPIC-V2-GOOGLE-SYNC`

6. `[QA] Baseline v2 regression scenario pack`
- labels: `area:qa`, `type:test`
- epic: `EPIC-V2-QA-AUTOMATION`

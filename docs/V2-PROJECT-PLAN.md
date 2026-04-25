# schedule-widget v2 Project Plan

## 1) Current State

- `v2` planning docs are in place (`V2-PRODUCT-BRIEF`, `V2-ROADMAP`, `V2-EXECUTION-CHECKLIST`).
- Repo bootstrap artifacts are in place (`.github` templates, scaffold folders in `apps/`, `packages/`, `tests/`).
- Active board cycle is `SW-023`: operationalize GitHub workflow and lock this project plan.
- Runtime implementation for `v2` has not started yet. Current codebase still contains `v1` app/runtime logic.

## 2) Practical v2 Goal

Deliver a usable local scheduler platform where:

- core behavior is owned by backend/domain layers (not renderer),
- SQLite is the source of truth,
- recurring behavior is deterministic and bounded (no infinite materialization),
- browse/live semantics are consistent,
- Codex API and Google sync run on the same domain contracts.

Success condition: complete slices 0-5 with QA evidence and manager final checks (`works` / `does not work`) per cycle.

## 3) Slice Sequence (Execution Order)

1. Slice 0: Foundation and Contracts
2. Slice 1A: UX Parity Shell (`v1` -> `v2` visual/interaction shape, stubs allowed)
3. Slice 1B: Day View Core (replace shell stubs with backend/domain data, no sync)
4. Slice 2: Recurring Projection
5. Slice 3: Codex Local API
6. Slice 4: Google Sync Adapter
7. Slice 5: QA Automation and Hardening

Rule: do not start the next slice until acceptance criteria for the current slice are met and recorded.

## 4) Dependencies Between Slices

- Slice 0 -> required by every later slice.
- Slice 1A -> depends on Slice 0 only loosely; it may use believable frontend stubs while contracts/storage continue to mature.
- Slice 1B -> depends on Slice 0 contracts and must preserve the accepted UX shell from Slice 1A while replacing fake data with real backend/domain outputs.
- Slice 2 -> depends on Slice 1B day projection and slot model.
- Slice 3 -> depends on Slice 0 contracts + Slice 1B task command paths.
- Slice 4 -> depends on Slice 3 command/API shape and Slice 1B/2 domain behavior.
- Slice 5 -> runs throughout, but final hardening depends on stable Slice 1A-4 outputs.

## 5) Definition of Done (Near-Term Slices)

### Slice 0 done when:

- migrations bootstrap on a clean machine,
- backend boot path starts without renderer crash,
- initial contracts and deterministic fixtures exist and are used in checks.

### Slice 1A done when:

- live `v2` visually matches the working UX structure of `v1`,
- the screen reads as one day flow: `Прошло` -> `Сейчас` -> `Текущий слот` -> `Далее`,
- taskable slots visually look actionable and believable even where logic is still stubbed,
- no temporary shell artifact looks obviously fake or disconnected,
- the accepted visual guide remains intact.

### Slice 1B done when:

- startup and date navigation are stable,
- day projection and CRUD work in slot and non-slot contexts,
- browse mode has no hidden fallback to live date semantics.

### Slice 2 done when:

- recurring appears only on eligible matching dates,
- non-matching dates do not get occurrences,
- projected recurring does not create unbounded persisted copies,
- default edit of projected occurrence updates the source template.

## 6) Recommended Owner Split

- Manager:
  - define bounded cycle scope,
  - map acceptance criteria to exact QA scenarios,
  - run final simplified smoke verdict.
- Primary Developer:
  - implement only assigned write scope,
  - report verification + residual risks honestly.
- Primary QA (read-only by default):
  - run code + runtime + visual sanity checks for assigned scenarios,
  - report pass/fail per scenario and residual risks.
- Optional Test Automation:
  - write/update tests only when explicitly assigned.

## 7) Required GitHub Usage Per Cycle

Each cycle must include:

- one implementation issue (`type:feature` or `type:bug` + `area:*` + epic key),
- one QA verification issue (`area:qa`, `type:test`),
- one PR linked to both issues, using the repo PR template,
- manager acceptance note with final `works` / `does not work` verdict.

Do not mix `v1` hotfix scope and `v2` slice scope in one issue/PR.

## 8) Immediate Next 3 Cycles

### Cycle A (`SW-023` closeout)

Focus:
- confirm GitHub label set is active,
- accept and freeze this project plan as manager baseline.

Acceptance focus:
- workflow is operational, not only documented.

### Cycle B (Slice 0 / Part 1)

Focus:
- SQLite migration bootstrap,
- minimal backend boot path,
- first contract package skeleton.

Acceptance focus:
- clean startup path + deterministic fixture loading.

### Cycle C (Slice 0 / Part 2)

Focus:
- first domain entrypoint wiring through contracts,
- initial command flow stubs for day context + task commands.

Acceptance focus:
- bounded executable baseline with no renderer feature expansion.

### Cycle D (Slice 1A / UX Parity Shell)

Focus:
- rebuild the visible `v1` day rhythm in live `v2`,
- restore the full day-flow shape and the current-slot-first UX,
- allow stubbed/fake data paths where backend truth is not ready yet, as long as they look fully intentional.

Acceptance focus:
- the screen feels like the old widget again, even if some interactions are still backed by placeholders.

## 9) Initial-Phase Risks

- scope drift from slice goals into ad-hoc runtime fixes,
- treating UX parity work as “cosmetic” instead of a prerequisite for validating the product shape,
- reintroducing business logic in renderer,
- recurring logic implemented before day/slot contracts stabilize,
- weak QA loops that rely on code reading only,
- unresolved ownership boundaries between manager/developer/tester.

## 10) Explicit Non-Goals (Initial Phase)

- full UI redesign unrelated to the accepted `v1`/Hacknet direction,
- full Google sync behavior parity with `v1`,
- broad optimization/performance work before Slice 1 stability,
- mixed `v1` rescue work inside `v2` slices unless explicitly escalated.

## 11) Manager Note: How UX Parity Fits the Main Plan

The current project no longer treats `v1`-style UX parity as a side quest.

Rule:

- first, make `v2` feel structurally like the old app,
- then replace stubbed shell behavior with real backend/domain behavior under the same UX shell.

That means:

- visual parity and believable placeholder behavior are part of delivery, not polish,
- backend work must serve the accepted shell instead of repeatedly changing the user-facing shape,
- future slices should prefer “keep the shell, swap the data source” over “redesign the screen again”.

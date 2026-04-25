# schedule-widget v2 Execution Checklist

This checklist is the manager startup path for turning v2 planning into execution.

## 1. Lock the first implementation slice

- Confirm active cycle scope: Slice 0 only (`foundation and contracts`).
- Keep v1 runtime patch work out of this cycle unless explicitly escalated.
- Assign disjoint write scopes to developer and tester before coding starts.

## 2. Bootstrap repository structure

- Confirm scaffold anchors exist in:
  - `apps/desktop`
  - `packages/domain`
  - `packages/backend`
  - `packages/storage-sqlite`
  - `packages/adapters`
  - `packages/contracts`
  - `tests`
- Confirm GitHub workflow artifacts are present (`issue/PR templates`, labels guide).

## 3. Define Slice 0 technical baseline

- Freeze first-pass contracts for day context and task commands.
- Define SQLite baseline tables and migration entrypoint.
- Define deterministic fixtures for schedule and date-driven projection inputs.

## 4. Run first developer cycle (Slice 0)

- Developer objective:
  - create migration bootstrap
  - create minimal backend boot path
  - create domain entrypoint stubs wired through contracts
- Constraints:
  - no UI feature expansion
  - no Google sync implementation yet
- Required output:
  - changed files
  - verification performed
  - residual risks

## 5. Run first QA cycle (Slice 0)

- QA must verify:
  - scaffold/contract coherence
  - migration startup path on a clean run
  - deterministic fixture loading
- QA report must include:
  - scenarios run
  - pass/fail per scenario
  - unverified items
  - residual risks

## 6. Manager acceptance gate

- Final manager check format:
  - `works` if Slice 0 acceptance is met
  - `does not work` otherwise
- Update task board with:
  - accepted output
  - follow-up tasks for Slice 1 (`day view core`)

## 7. Immediate next cycle after Slice 0

- Start Slice 1A first, not the backend-heavy part of Slice 1.
- Rebuild the accepted `v1` UX shell in live `v2` before widening backend scope.
- Allow believable stub behavior in slot/task surfaces when backend truth is not ready yet.
- Keep recurring, local API expansion, and Google sync deferred to their planned slices.

## 8. Slice 1A manager checklist

- Confirm the shell now exposes:
  - `Прошло`
  - `Сейчас`
  - `Текущий слот`
  - `Далее`
- Confirm active slot is visually first in the working area.
- Confirm day flow is not reduced to only a partial slot list.
- Confirm placeholder/stub interactions look intentional and product-like.
- Confirm the visual shell still follows `V2-VISUAL-STYLE-GUIDE.md`.

## 9. Slice 1B follow-through rule

- Once Slice 1A is accepted, backend/domain work must preserve the shell shape.
- Replace stubbed data and interactions behind the accepted UI instead of redesigning the screen again.

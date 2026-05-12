# schedule-widget v2 Product Brief

## Purpose

`schedule-widget v2` is a local desktop day-operations widget:

- view a day as structured slots
- create and edit tasks quickly inside slots
- browse past and future dates without semantic drift
- sync only selected tasks to Google Calendar
- expose a safe local API for Codex-driven task entry

This is not a general-purpose calendar. It is a personal operational control panel.

## Operating Rhythm

The default day structure follows the three-zone schedule in `docs/SCHEDULE-LOGIC.md`:

- `09:00-10:00`: planning the day and launching the sprint
- `10:00-13:00`: work-task slots using the red work tone
- `13:00-16:00`: personal-task slots using the green development tone

The product should help protect this rhythm through slot placement first: plan, work tasks, then personal tasks.

## Why v2

v1 accumulated coupled logic across renderer, sync, state, and runtime behaviors. This caused repeated regressions where one fix reopened another path.

v2 is a controlled rewrite to:

- separate business logic from UI rendering
- move source-of-truth data into SQLite
- make recurring behavior deterministic and bounded
- enforce one domain model used by UI, API, and sync

## Architecture Layers

1. `Renderer UI`
- renders a prepared day-view model
- sends user commands
- does not implement business rules

2. `Application Backend (Electron main)`
- orchestrates use-cases
- validates commands
- serves IPC and local HTTP API

3. `Domain Core`
- pure date/slot/task/recurring projection logic
- live vs browse semantics
- sync input derivation

4. `Infrastructure`
- SQLite repositories
- Watson schedule import adapters
- Google sync adapter
- persistence and logging adapters

## Data Direction: SQLite + Local Backend

v2 stores operational state in local SQLite. Renderer does not own source-of-truth.

Primary entities:

- `schedule_templates`
- `schedule_slots`
- `sprint_cards`
- `tasks`
- `task_recurrence` (or recurrence fields in `tasks`)
- `task_exceptions`
- `overlay_events`
- `sync_runs`
- `settings`

## Recurring / Continuing Tasks

Recurring tasks are templates, not pre-generated copies.

Rules:

- persist one recurring source template
- project occurrences lazily for a requested `target_date`
- for slot-bound recurring tasks, require exact matching slot kind and exact start/end time
- no match means no occurrence for that day

Anti-infinite-materialization rule:

- never expand recurring tasks into unbounded future rows
- never bulk-create unlimited future copies in persisted storage
- projection must be point lookup (`one date`) or explicitly bounded range lookup

## Browse vs Live Semantics

Live mode:

- reference date is current date
- time-sensitive status uses current wall clock

Browse mode:

- reference date is selected date
- status, slot availability, projection, and overlays are evaluated against selected date
- no hidden fallback to live date for core behavior

## Sync and Codex API Boundaries

Google sync:

- explicit user action by default
- sync only tasks with `calendarMode = google`
- base slots are never auto-created as Google events
- sync failures must not block core widget usage

Local Codex API:

- local-only boundary
- strict input validation
- domain commands only (not direct renderer-state mutations)
- commands include context/day read, task CRUD, date navigation command, manual sync trigger

## Test Environment and Guide Expectations

v2 requires a deterministic local test environment:

- isolated test SQLite database
- deterministic schedule fixtures
- fake or controlled sync adapter for repeatable runs
- explicit reference-date control for tests

Required guides:

- product behavior guide
- recurring and date semantics guide
- QA scenario guide

## QA and Manager Acceptance Expectations

QA is not code-review-only. For each user-visible change, QA must run assigned functional scenarios and visual sanity checks.

Manager performs a final simplified smoke check before accepting:

- `works`
- `does not work`

This manager check is required and does not replace QA.

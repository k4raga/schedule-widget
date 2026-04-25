# tests

`tests` is the v2 verification anchor for automated coverage.

Ownership:

- domain unit tests (date, slot, recurring projection)
- backend integration tests (command handlers and repository wiring)
- narrow end-to-end smoke checks for startup and critical flows

Execution principle:

- prioritize deterministic tests first
- keep UI smoke coverage focused on critical user paths
- align with `.codex-workflow/test-scenarios.md` and v2 roadmap slices

First implementation target:

- add deterministic fixtures and first domain projection tests during Slice 0/1.

# packages/storage-sqlite

`packages/storage-sqlite` owns the local SQLite persistence layer for v2.

Ownership:

- schema and migrations
- repository implementations
- query helpers for tasks, slots, overlays, and sync history

Constraints:

- do not embed UI logic
- do not embed recurring projection behavior
- keep storage APIs explicit and testable

First implementation target:

- bootstrap migration flow and a repository surface sufficient for Slice 0 and Slice 1.

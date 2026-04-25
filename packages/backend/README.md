# packages/backend

`packages/backend` orchestrates v2 application use-cases.

Ownership:

- command handlers for task CRUD and date navigation
- application services that call domain + storage + adapters
- validation entry points used by IPC and local HTTP API

Constraints:

- business decisions should delegate to `packages/domain`
- storage should go through repository interfaces, not ad-hoc reads/writes

First implementation target:

- a minimal command pipeline that can return a projected day context for a selected date.

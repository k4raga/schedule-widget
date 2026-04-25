# packages/contracts

`packages/contracts` defines shared DTOs and validation shapes for v2.

Ownership:

- command/request contracts
- response contracts
- shared type definitions between backend, API, and desktop renderer

Constraints:

- contracts should remain transport-neutral
- keep this package stable and backward-compatible when possible

First implementation target:

- initial day context, task command, and sync result contracts aligned with Slice 0 and Slice 1.

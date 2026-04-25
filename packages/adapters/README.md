# packages/adapters

`packages/adapters` contains infrastructure adapters around external boundaries.

Ownership:

- Watson schedule import adapter
- Google sync adapter
- local API transport wiring (if split from backend)
- logging and telemetry bridges

Constraints:

- adapters should translate data at boundaries
- core behavior stays in domain/backend layers

First implementation target:

- define adapter interfaces and one deterministic test adapter for non-network runs.

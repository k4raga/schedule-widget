# packages/domain

`packages/domain` contains pure business logic for v2.

Ownership:

- day projection rules
- browse vs live date semantics
- recurring projection and eligibility matching
- sync input preparation rules

Constraints:

- no filesystem I/O
- no Electron APIs
- no HTTP concerns
- no SQLite adapter code

First implementation target:

- deterministic projection functions that accept explicit inputs and return a day view model.

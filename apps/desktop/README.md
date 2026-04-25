# apps/desktop

`apps/desktop` is the v2 desktop app surface.

Ownership:

- Electron shell bootstrap and window lifecycle
- renderer app composition and view wiring
- IPC client bindings to backend command handlers

Out of scope for this folder:

- core domain rules for slots, dates, recurring, or sync eligibility
- direct SQLite schema and repository ownership

First implementation target:

- a minimal shell that can request and render a backend-provided day view model.

## MVP Surface (SW-024)

This folder now contains a minimal Electron desktop surface for v2 MVP:

- `main.js` - minimal Electron shell entrypoint
- `preload.js` - safe API bridge from renderer to IPC
- `index.html`, `styles.css`, `renderer.js` - task list + create form UI

The renderer does not own business logic and does not persist data directly.
It only calls API methods exposed by preload.

## Required IPC Hooks (Integrator Contract)

If this surface is wired into the app, the host process should implement:

- `v2:day-context:get` with payload `{ dateKey: string }`
- `v2:tasks:list` with payload `{ dateKey: string }`
- `v2:tasks:create` with payload `{ title: string, dateKey: string }`

Expected return shape:

- `v2:day-context:get` -> `{ dateKey: string, label?: string }`
- `v2:tasks:list` -> `{ tasks: Array<{ id?: string, title: string, status?: string, startTime?: string, endTime?: string }> }`
- `v2:tasks:create` -> created task object or ack object

The renderer gracefully reports bridge/API errors when hooks are not wired yet.

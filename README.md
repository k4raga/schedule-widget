# Schedule Widget

Compact Electron desktop scheduler for local day planning.

This repository contains the current `v2` desktop implementation of Watson Desk. It is published for reference and portfolio review.

## What It Does

- Provides a local desktop schedule widget for planning a personal day.
- Stores app data locally.
- Imports selected-day Google Calendar events through a read-only sync bridge.
- Builds a Windows portable package with Electron Builder.

Google Calendar sync is read-only: it imports calendar events into local external-event storage and does not create or modify Google Calendar events.

## Project Layout

- App shell: `apps/desktop/main.js`
- Preload bridge: `apps/desktop/preload.js`
- UI renderer: `apps/desktop/renderer.js`
- UI helpers: `apps/desktop/schedule-helpers.js`
- Styles: `apps/desktop/styles.css`
- Backend: `packages/backend`
- SQLite storage: `packages/storage-sqlite`
- Contracts: `packages/contracts`
- Google Calendar read-only sync bridge: `google-sync.js`

`v2` is the active app. The old root-level `v1` Electron entry and its renderer files were removed to avoid shipping or launching the wrong implementation.

## Commands

Install dependencies:

```sh
npm ci
```

Launch the current desktop app:

```sh
npm start
```

Run smoke tests:

```sh
npm test
```

Run the optional task sync server:

```sh
npm run sync-server
```

See `docs/SYNC-SERVER.md` for client/server configuration.

Build the Windows portable package:

```sh
npm run build
```

## Visual Standard

The live UI follows the Hacknet-terminal direction documented in:

- `docs/V2-VISUAL-STYLE-GUIDE.md`

Future visible UI changes should either follow that guide or update it in the same cycle.

## CI

GitHub Actions runs the public validation path on pull requests and pushes to `main`:

- `npm ci`
- `npm test`
- `npm run build`

## License

This repository is public for reference and portfolio review only. No open-source license is granted.

See `LICENSE.md` for the full notice.

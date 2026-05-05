# Sync Server

`schedule-widget` can sync task data through a small HTTP server instead of syncing the live SQLite file.

The app keeps SQLite local. The server stores an append-only task operation log:

- `upsert_task`
- `delete_task`

This avoids overwriting an open `.sqlite` file and lets deletes travel between computers.

## Server

Run on the server:

```sh
WATSON_DESK_SYNC_TOKEN="replace-with-long-random-token" npm run sync-server
```

Optional env:

```sh
WATSON_DESK_SYNC_HOST=0.0.0.0
WATSON_DESK_SYNC_PORT=3199
WATSON_DESK_SYNC_DATA_DIR=/var/lib/watson-desk-sync
```

Health check:

```sh
curl http://server:3199/health
```

The sync API requires:

```text
Authorization: Bearer <token>
```

## Client

Create a local ignored config file:

```json
{
  "serverUrl": "http://server:3199",
  "token": "replace-with-long-random-token"
}
```

Save it as:

```text
data/sync-client.json
```

Environment variables override the file:

```sh
WATSON_DESK_SYNC_SERVER_URL=http://server:3199
WATSON_DESK_SYNC_TOKEN=replace-with-long-random-token
```

## UI

The top bar has two sync buttons:

- `⇄` imports selected-day Google Calendar events.
- `⇅` syncs the local task database with the sync server.

## Current Scope

Synced now:

- local tasks
- task title/date/time/status/scope
- task delete operations

Not synced yet:

- Google overlay events
- app settings except the internal sync client id
- future knowledge-table entities once their schema exists

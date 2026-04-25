"use strict";

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { createV2MvpBackend } = require("../packages/backend");

const WORK_GOOGLE_CALENDAR_ID = "3def21724634cc82d171f8c8028fb088f842e2b4cc8f9aa524ad3b2b09d5ad9a@group.calendar.google.com";

function tempDbPath() {
  return path.join(
    os.tmpdir(),
    `schedule-widget-v2-external-sync-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
}

async function run() {
  const dbPath = tempDbPath();
  const backend = await createV2MvpBackend({
    dbPath,
    seedData: {
      selectedDate: "2026-04-13",
      initialTasks: [
        {
          id: "local-task-1",
          date: "2026-04-13",
          title: "Локальная задача",
          status: "todo",
          startTime: "10:00",
          endTime: "11:00",
          createdAt: "2026-04-13T00:00:00.000Z",
          updatedAt: "2026-04-13T00:00:00.000Z",
        },
      ],
    },
    googleReadSyncAdapter: async ({ targetDate }) => ({
      ok: true,
      reason: "",
      targetDate,
      checkedCalendars: ["primary", "work", "family"],
      overlayEvents: [
        { title: "Google Event A", start: "09:00", end: "09:30", source: "primary", calendarId: "primary" },
        { title: "📋 Проверка тендеров", start: "10:00", end: "11:00", source: "primary", calendarId: "primary" },
        { title: "Google Event B", start: "12:30", end: "13:30", source: "work", calendarId: WORK_GOOGLE_CALENDAR_ID },
      ],
      notes: "",
    }),
  });

  try {
    const syncResult = await backend.syncGoogleDayReadOnly({ date: "2026-04-13" });
    assert.equal(syncResult.ok, true);
    assert.equal(syncResult.importedCount, 2);

    const context = await backend.getDayContext({ date: "2026-04-13" });
    assert.equal(Array.isArray(context.tasks), true);
    assert.equal(context.tasks.length, 1);
    assert.equal(Array.isArray(context.externalEvents), true);
    assert.equal(context.externalEvents.length, 2);
    assert.equal(context.externalEvents[0].title, "Google Event A");
    assert.equal(context.externalEvents[1].title, "Google Event B");
    assert.equal(context.externalEvents.some((event) => event.title.includes("Проверка тендер")), false);
    assert.equal(context.externalEvents[1].calendarId, WORK_GOOGLE_CALENDAR_ID);

    console.log("smoke-external-events-sync: ok");
  } finally {
    await backend.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

run().catch((error) => {
  console.error("smoke-external-events-sync: failed");
  console.error(error);
  process.exit(1);
});

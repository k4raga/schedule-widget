"use strict";

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { createV2MvpBackend } = require("../packages/backend");

function tempDbPath() {
  return path.join(
    os.tmpdir(),
    `schedule-widget-v2-daily-notes-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
}

async function run() {
  const dbPath = tempDbPath();
  const backend = await createV2MvpBackend({
    dbPath,
    seedData: {
      selectedDate: "2026-05-05",
      initialTasks: [],
    },
  });

  try {
    const yesterdayNote = await backend.createTask({
      title: "Армори · 30 мин",
      date: "2026-05-04",
      startTime: "00:00",
      endTime: "00:01",
      scope: "week",
    });
    await backend.setTaskStatus({ id: yesterdayNote.id, status: "done" });

    const yesterdayTasks = await backend.listTasksForDate({ date: "2026-05-04" });
    const todayTasks = await backend.listTasksForDate({ date: "2026-05-05" });

    assert.equal(yesterdayTasks.find((task) => task.id === yesterdayNote.id)?.status, "done");
    assert.equal(todayTasks.some((task) => task.title === "Армори · 30 мин"), false);

    const openTemporaryNote = await backend.createTask({
      title: "Open carry note",
      date: "2026-05-04",
      startTime: "00:04",
      endTime: "00:05",
      scope: "week",
    });
    const doneTemporaryNote = await backend.createTask({
      title: "Done carry note",
      date: "2026-05-04",
      startTime: "00:05",
      endTime: "00:06",
      scope: "week",
    });
    await backend.setTaskStatus({ id: doneTemporaryNote.id, status: "done" });

    const carrySourceTasks = await backend.listTasksForDate({ date: "2026-05-04" });
    const carried = carrySourceTasks
      .filter((task) => task.scope === "week")
      .filter((task) => task.startTime >= "00:04")
      .filter((task) => task.status !== "done");

    assert.equal(carried.length, 1);
    assert.equal(carried[0].id, openTemporaryNote.id);

    console.log("smoke-daily-notes: ok");
  } finally {
    await backend.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

run().catch((error) => {
  console.error("smoke-daily-notes: failed");
  console.error(error);
  process.exit(1);
});

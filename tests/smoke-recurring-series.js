"use strict";

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { createV2MvpBackend } = require("../packages/backend");

function tempDbPath() {
  return path.join(
    os.tmpdir(),
    `schedule-widget-v2-recurring-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
}

async function run() {
  const dbPath = tempDbPath();
  const backend = await createV2MvpBackend({
    dbPath,
    seedData: {
      selectedDate: "2026-04-10",
      initialTasks: [],
    },
  });

  try {
    await backend.createTask({
      title: "Уже занято",
      date: "2026-04-12",
      startTime: "10:00",
      endTime: "11:00",
    });

    const result = await backend.createRecurringTaskSeries({
      title: "Серия",
      anchorDate: "2026-04-10",
      startTime: "10:00",
      endTime: "11:00",
      dateKeys: ["2026-04-10", "2026-04-11", "2026-04-12", "2026-04-13"],
    });

    assert.equal(result.createdCount, 3);
    assert.equal(result.skippedCount, 1);
    assert.deepEqual(result.skippedDates, ["2026-04-12"]);

    const day10 = await backend.listTasksForDate({ date: "2026-04-10" });
    const day11 = await backend.listTasksForDate({ date: "2026-04-11" });
    const day12 = await backend.listTasksForDate({ date: "2026-04-12" });
    const day13 = await backend.listTasksForDate({ date: "2026-04-13" });

    assert.equal(day10.filter((task) => task.title === "Серия").length, 1);
    assert.equal(day11.filter((task) => task.title === "Серия").length, 1);
    assert.equal(day12.filter((task) => task.title === "Серия").length, 0);
    assert.equal(day13.filter((task) => task.title === "Серия").length, 1);

    console.log("smoke-recurring-series: ok");
  } finally {
    await backend.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

run().catch((error) => {
  console.error("smoke-recurring-series: failed");
  console.error(error);
  process.exit(1);
});


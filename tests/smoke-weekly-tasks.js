"use strict";

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { createV2MvpBackend } = require("../packages/backend");

function tempDbPath() {
  return path.join(
    os.tmpdir(),
    `schedule-widget-v2-weekly-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  );
}

async function run() {
  const dbPath = tempDbPath();
  const backend = await createV2MvpBackend({
    dbPath,
    seedData: {
      selectedDate: "2026-04-13",
      initialTasks: [],
    },
  });

  try {
    const weeklyTask = await backend.createTask({
      title: "Weekly focus",
      date: "2026-04-13",
      startTime: "00:02",
      endTime: "00:03",
      scope: "week",
    });

    await backend.createTask({
      title: "Day focus",
      date: "2026-04-13",
      startTime: "10:00",
      endTime: "11:00",
    });

    const mondayTasks = await backend.listTasksForDate({ date: "2026-04-13" });
    assert.equal(mondayTasks.filter((task) => task.scope === "week").length, 1);
    assert.equal(mondayTasks.filter((task) => task.scope === "day").length, 1);

    const updatedWeeklyTask = await backend.updateTask({
      id: weeklyTask.id,
      title: "Weekly focus updated",
      date: "2026-04-13",
      startTime: "00:02",
      endTime: "00:03",
      scope: "week",
    });
    assert.equal(updatedWeeklyTask.scope, "week");

    const nextMondayTasks = await backend.listTasksForDate({ date: "2026-04-20" });
    assert.equal(nextMondayTasks.length, 0);

    console.log("smoke-weekly-tasks: ok");
  } finally {
    await backend.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

run().catch((error) => {
  console.error("smoke-weekly-tasks: failed");
  console.error(error);
  process.exit(1);
});

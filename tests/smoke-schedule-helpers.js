"use strict";

const assert = require("node:assert/strict");

const helpers = require("../apps/desktop/schedule-helpers");

const monday = "2026-04-13";
const sunday = "2026-04-19";
const nextMonday = "2026-04-20";

assert.equal(helpers.weekStartDateKey(monday), monday);
assert.equal(helpers.weekEndDateKey(monday), sunday);
assert.equal(helpers.weekStartDateKey(sunday), monday);
assert.equal(helpers.weekStartDateKey(nextMonday), nextMonday);

assert.deepEqual(helpers.weeklySlotRange(2), {
  startTime: "00:02",
  endTime: "00:03",
});

const taskResponse = { tasks: [{ id: "a" }] };
assert.deepEqual(helpers.parseTaskListResponse(taskResponse), taskResponse.tasks);
assert.deepEqual(helpers.parseTaskListResponse(null), []);

const tasks = [
  { id: "day", scope: "day", startTime: "00:00", endTime: "00:01" },
  { id: "week-2", scope: "week", startTime: "00:02", endTime: "00:03", createdAt: "b" },
  { id: "week-1", scope: "week", startTime: "00:01", endTime: "00:02", createdAt: "a" },
];

assert.deepEqual(helpers.sortWeeklyTasks(tasks, 4).map((task) => task.id), ["week-1", "week-2"]);
assert.equal(helpers.findWeeklyTaskForSlot(tasks, 2).id, "week-2");
assert.equal(helpers.findWeeklyTaskForSlot(tasks, 3), null);

console.log("smoke-schedule-helpers: ok");

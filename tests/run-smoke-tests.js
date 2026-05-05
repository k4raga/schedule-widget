"use strict";

const { spawnSync } = require("node:child_process");

const checks = [
  ["node", ["tests/smoke-database-sync.js"]],
  ["node", ["tests/smoke-daily-notes.js"]],
  ["node", ["tests/smoke-external-events-sync.js"]],
  ["node", ["tests/smoke-recurring-series.js"]],
  ["node", ["tests/smoke-schedule-helpers.js"]],
  ["node", ["tests/smoke-weekly-tasks.js"]],
];

for (const [command, args] of checks) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("smoke-tests: ok");

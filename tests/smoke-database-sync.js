"use strict";

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { createV2MvpBackend } = require("../packages/backend");
const { createSyncServer } = require("../apps/sync-server/server");

function tempDir() {
  return path.join(
    os.tmpdir(),
    `schedule-widget-v2-sync-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function run() {
  const root = tempDir();
  const token = "test-sync-token";
  const server = createSyncServer({
    token,
    dataDir: path.join(root, "server"),
  });
  const port = await listen(server);
  const serverUrl = `http://127.0.0.1:${port}`;

  const backendA = await createV2MvpBackend({
    dbPath: path.join(root, "a.sqlite"),
    seedData: { selectedDate: "2026-05-05", initialTasks: [] },
  });
  const backendB = await createV2MvpBackend({
    dbPath: path.join(root, "b.sqlite"),
    seedData: { selectedDate: "2026-05-05", initialTasks: [] },
  });

  try {
    const created = await backendA.createTask({
      title: "Синхронизируемая задача",
      date: "2026-05-05",
      startTime: "09:00",
      endTime: "10:00",
    });

    const pushResult = await backendA.syncDatabaseWithServer({ serverUrl, token });
    assert.equal(pushResult.ok, true);
    assert.equal(pushResult.pushedCount, 1);

    const pullResult = await backendB.syncDatabaseWithServer({ serverUrl, token });
    assert.equal(pullResult.ok, true);
    assert.equal(pullResult.appliedCount, 1);
    let bTasks = await backendB.listTasksForDate({ date: "2026-05-05" });
    assert.equal(bTasks.length, 1);
    assert.equal(bTasks[0].title, "Синхронизируемая задача");

    await backendB.updateTask({
      id: created.id,
      title: "Обновлена на втором компьютере",
      date: "2026-05-05",
      startTime: "09:00",
      endTime: "10:00",
    });
    await backendB.syncDatabaseWithServer({ serverUrl, token });
    const aUpdatePull = await backendA.syncDatabaseWithServer({ serverUrl, token });
    assert.equal(aUpdatePull.ok, true);
    const aTasksAfterUpdate = await backendA.listTasksForDate({ date: "2026-05-05" });
    assert.equal(aTasksAfterUpdate[0].title, "Обновлена на втором компьютере");

    await backendB.deleteTask({ id: created.id });
    await backendB.syncDatabaseWithServer({ serverUrl, token });
    const aDeletePull = await backendA.syncDatabaseWithServer({ serverUrl, token });
    assert.equal(aDeletePull.ok, true);
    const aTasksAfterDelete = await backendA.listTasksForDate({ date: "2026-05-05" });
    assert.equal(aTasksAfterDelete.length, 0);

    console.log("smoke-database-sync: ok");
  } finally {
    await backendA.close();
    await backendB.close();
    await closeServer(server);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error("smoke-database-sync: failed");
  console.error(error);
  process.exit(1);
});

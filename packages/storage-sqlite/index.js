"use strict";

const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js/dist/sql-asm.js");

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "v2-mvp.sqlite");
const DEFAULT_SEED = Object.freeze({
  selectedDate: "2026-04-09",
  initialTasks: [],
});

let sqlModulePromise = null;

function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs();
  }
  return sqlModulePromise;
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeSeed(seed) {
  const selectedDate =
    typeof seed?.selectedDate === "string" ? seed.selectedDate : DEFAULT_SEED.selectedDate;
  const initialTasks = Array.isArray(seed?.initialTasks) ? seed.initialTasks : [];
  return { selectedDate, initialTasks };
}

function readMvpSeedFile(seedPath) {
  if (!seedPath || !fs.existsSync(seedPath)) {
    return { ...DEFAULT_SEED };
  }

  const raw = fs.readFileSync(seedPath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeSeed(parsed);
}

function buildSeedTask(seedTask, selectedDate, index) {
  const now = "2026-04-09T00:00:00.000Z";
  const id =
    typeof seedTask?.id === "string" && seedTask.id.trim()
      ? seedTask.id.trim()
      : `seed-task-${String(index + 1).padStart(3, "0")}`;
  return {
    id,
    date: typeof seedTask?.date === "string" ? seedTask.date : selectedDate,
    title:
      typeof seedTask?.title === "string" && seedTask.title.trim()
        ? seedTask.title.trim()
        : "Seed task",
    status: typeof seedTask?.status === "string" ? seedTask.status : "todo",
    startTime: typeof seedTask?.startTime === "string" ? seedTask.startTime : null,
    endTime: typeof seedTask?.endTime === "string" ? seedTask.endTime : null,
    scope: seedTask?.scope === "week" ? "week" : "day",
    createdAt: typeof seedTask?.createdAt === "string" ? seedTask.createdAt : now,
    updatedAt: typeof seedTask?.updatedAt === "string" ? seedTask.updatedAt : now,
  };
}

function rowToTask(row) {
  return {
    id: row.id,
    date: row.date,
    dueDate: row.date,
    title: row.title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    scope: row.scope || "day",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToExternalEvent(row) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    start: row.start_time,
    end: row.end_time,
    source: row.source,
    calendarId: row.calendar_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SqliteMvpStorage {
  constructor(sqlModule, options = {}) {
    this.SQL = sqlModule;
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.seed = normalizeSeed(options.seedData || readMvpSeedFile(options.seedPath));
    this.persistDepth = 0;
    this.persistDirty = false;

    ensureDirectory(this.dbPath);

    const existingBytes = fs.existsSync(this.dbPath) ? fs.readFileSync(this.dbPath) : null;
    this.db = existingBytes ? new this.SQL.Database(existingBytes) : new this.SQL.Database();
    this.initialize();
  }

  initialize() {
    this.db.run(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        scope TEXT NOT NULL DEFAULT 'day',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS tasks_date_created_idx
      ON tasks(date, created_at);
      CREATE INDEX IF NOT EXISTS tasks_carryover_idx
      ON tasks(scope, status, date, start_time);
      CREATE TABLE IF NOT EXISTS external_events (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        source TEXT NOT NULL,
        calendar_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS external_events_date_idx
      ON external_events(date, start_time, end_time);
      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        pushed_at TEXT,
        operation_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sync_operations_pushed_idx
      ON sync_operations(pushed_at, created_at);
      CREATE TABLE IF NOT EXISTS applied_sync_operations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    this.ensureColumn("tasks", "scope", "TEXT NOT NULL DEFAULT 'day'");

    this.db.run(
      "INSERT OR IGNORE INTO settings(key, value) VALUES ('selected_date', ?)",
      [this.seed.selectedDate]
    );

    const countRow = this.db.exec("SELECT COUNT(*) AS count FROM tasks");
    const count = countRow[0]?.values?.[0]?.[0] ?? 0;
    if (count === 0 && this.seed.initialTasks.length > 0) {
      const insert = this.db.prepare(`
        INSERT OR IGNORE INTO tasks
        (id, date, title, status, start_time, end_time, scope, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        for (const [index, seedTask] of this.seed.initialTasks.entries()) {
          const task = buildSeedTask(seedTask, this.seed.selectedDate, index);
          insert.run([
            task.id,
            task.date,
            task.title,
            task.status,
            task.startTime,
            task.endTime,
            task.scope,
            task.createdAt,
            task.updatedAt,
          ]);
        }
      } finally {
        insert.free();
      }
    }

    this.persist();
  }

  ensureColumn(tableName, columnName, columnDefinition) {
    const tableInfo = this.db.exec(`PRAGMA table_info(${tableName})`);
    const rows = tableInfo[0]?.values || [];
    const hasColumn = rows.some((row) => row[1] === columnName);
    if (!hasColumn) {
      this.db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
  }

  persist() {
    if (this.persistDepth > 0) {
      this.persistDirty = true;
      return;
    }

    const exported = this.db.export();
    fs.writeFileSync(this.dbPath, exported);
  }

  deferPersistence(work) {
    this.persistDepth += 1;
    try {
      return work();
    } finally {
      this.persistDepth -= 1;
      if (this.persistDepth === 0 && this.persistDirty) {
        this.flushDeferredPersistence();
      }
    }
  }

  flushDeferredPersistence() {
    this.persistDirty = false;
    try {
      this.persist();
    } catch (error) {
      this.persistDirty = true;
      throw error;
    }
  }

  getSelectedDate() {
    const result = this.db.exec("SELECT value FROM settings WHERE key = 'selected_date'");
    return result[0]?.values?.[0]?.[0] ?? this.seed.selectedDate;
  }

  getSettingValue(key) {
    const statement = this.db.prepare("SELECT value FROM settings WHERE key = ? LIMIT 1");
    try {
      statement.bind([key]);
      if (!statement.step()) {
        return null;
      }
      return statement.getAsObject().value ?? null;
    } finally {
      statement.free();
    }
  }

  setSettingValue(key, value) {
    this.db.run(
      "INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)",
      [key, value]
    );
    this.persist();
  }

  setSelectedDate(date) {
    this.setSettingValue("selected_date", date);
  }

  listTasksByDate(date) {
    const statement = this.db.prepare(`
      SELECT id, date, title, status, start_time, end_time, scope, created_at, updated_at
      FROM tasks
      WHERE date = ?
      ORDER BY created_at ASC, id ASC
    `);

    try {
      statement.bind([date]);
      const rows = [];
      while (statement.step()) {
        rows.push(rowToTask(statement.getAsObject()));
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  listCarryoverWeekTasks({ beforeDate, sinceDate, minStartTime }) {
    const statement = this.db.prepare(`
      SELECT id, date, title, status, start_time, end_time, scope, created_at, updated_at
      FROM tasks
      WHERE scope = 'week'
        AND status != 'done'
        AND date < ?
        AND date >= ?
        AND start_time >= ?
      ORDER BY date DESC, start_time ASC, created_at ASC, id ASC
    `);

    try {
      statement.bind([beforeDate, sinceDate, minStartTime || "00:00"]);
      const rows = [];
      while (statement.step()) {
        rows.push(rowToTask(statement.getAsObject()));
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  listAllTasks() {
    const statement = this.db.prepare(`
      SELECT id, date, title, status, start_time, end_time, scope, created_at, updated_at
      FROM tasks
      ORDER BY date ASC, created_at ASC, id ASC
    `);

    try {
      const rows = [];
      while (statement.step()) {
        rows.push(rowToTask(statement.getAsObject()));
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  getTaskById(id) {
    const statement = this.db.prepare(`
      SELECT id, date, title, status, start_time, end_time, scope, created_at, updated_at
      FROM tasks
      WHERE id = ?
      LIMIT 1
    `);

    try {
      statement.bind([id]);
      if (!statement.step()) {
        return null;
      }
      return rowToTask(statement.getAsObject());
    } finally {
      statement.free();
    }
  }

  createTask(task) {
    this.db.run(
      `
      INSERT INTO tasks
      (id, date, title, status, start_time, end_time, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        task.id,
        task.date,
        task.title,
        task.status,
        task.startTime,
        task.endTime,
        task.scope || "day",
        task.createdAt,
        task.updatedAt,
      ]
    );
    this.persist();
    return task;
  }

  upsertTask(task) {
    const existing = this.getTaskById(task.id);
    if (existing && String(existing.updatedAt || "") > String(task.updatedAt || "")) {
      return false;
    }

    this.db.run(
      `
      INSERT OR REPLACE INTO tasks
      (id, date, title, status, start_time, end_time, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        task.id,
        task.date,
        task.title,
        task.status || "todo",
        task.startTime,
        task.endTime,
        task.scope || "day",
        task.createdAt,
        task.updatedAt,
      ]
    );
    this.persist();
    return true;
  }

  createTasks(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return 0;
    }

    const insert = this.db.prepare(`
      INSERT INTO tasks
      (id, date, title, status, start_time, end_time, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let created = 0;
    try {
      for (const task of tasks) {
        insert.run([
          task.id,
          task.date,
          task.title,
          task.status,
          task.startTime,
          task.endTime,
          task.scope || "day",
          task.createdAt,
          task.updatedAt,
        ]);
        created += 1;
      }
    } finally {
      insert.free();
    }

    if (created > 0) {
      this.persist();
    }
    return created;
  }

  listExternalEventsByDate(date) {
    const statement = this.db.prepare(`
      SELECT id, date, title, start_time, end_time, source, calendar_id, created_at, updated_at
      FROM external_events
      WHERE date = ?
      ORDER BY start_time ASC, end_time ASC, title ASC, id ASC
    `);

    try {
      statement.bind([date]);
      const rows = [];
      while (statement.step()) {
        rows.push(rowToExternalEvent(statement.getAsObject()));
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  replaceExternalEventsByDate(date, events) {
    this.db.run("DELETE FROM external_events WHERE date = ?", [date]);

    if (!Array.isArray(events) || events.length === 0) {
      this.persist();
      return 0;
    }

    const insert = this.db.prepare(`
      INSERT INTO external_events
      (id, date, title, start_time, end_time, source, calendar_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let created = 0;
    try {
      for (const event of events) {
        insert.run([
          event.id,
          event.date,
          event.title,
          event.start,
          event.end,
          event.source,
          event.calendarId,
          event.createdAt,
          event.updatedAt,
        ]);
        created += 1;
      }
    } finally {
      insert.free();
    }

    this.persist();
    return created;
  }

  updateTask(task) {
    this.db.run(
      `
      UPDATE tasks
      SET date = ?, title = ?, status = ?, start_time = ?, end_time = ?, scope = ?, updated_at = ?
      WHERE id = ?
    `,
      [
        task.date,
        task.title,
        task.status,
        task.startTime,
        task.endTime,
        task.scope || "day",
        task.updatedAt,
        task.id,
      ]
    );

    const changed = this.db.getRowsModified();
    if (changed > 0) {
      this.persist();
    }
    return changed > 0;
  }

  setTaskStatus(id, status, updatedAt) {
    this.db.run(
      `
      UPDATE tasks
      SET status = ?, updated_at = ?
      WHERE id = ?
    `,
      [status, updatedAt, id]
    );

    const changed = this.db.getRowsModified();
    if (changed > 0) {
      this.persist();
    }
    return changed > 0;
  }

  deleteTask(id) {
    this.db.run("DELETE FROM tasks WHERE id = ?", [id]);
    const changed = this.db.getRowsModified();
    if (changed > 0) {
      this.persist();
    }
    return changed > 0;
  }

  recordSyncOperation(operation) {
    this.db.run(
      `
      INSERT OR IGNORE INTO sync_operations
      (id, client_id, created_at, pushed_at, operation_json)
      VALUES (?, ?, ?, NULL, ?)
    `,
      [
        operation.id,
        operation.clientId,
        operation.createdAt,
        JSON.stringify(operation),
      ]
    );
    const changed = this.db.getRowsModified();
    if (changed > 0) {
      this.persist();
    }
    return changed > 0;
  }

  listPendingSyncOperations() {
    const statement = this.db.prepare(`
      SELECT operation_json
      FROM sync_operations
      WHERE pushed_at IS NULL
      ORDER BY created_at ASC, id ASC
    `);

    try {
      const operations = [];
      while (statement.step()) {
        operations.push(JSON.parse(String(statement.getAsObject().operation_json || "{}")));
      }
      return operations;
    } finally {
      statement.free();
    }
  }

  listAllSyncOperations() {
    const statement = this.db.prepare(`
      SELECT operation_json
      FROM sync_operations
      ORDER BY created_at ASC, id ASC
    `);

    try {
      const operations = [];
      while (statement.step()) {
        operations.push(JSON.parse(String(statement.getAsObject().operation_json || "{}")));
      }
      return operations;
    } finally {
      statement.free();
    }
  }

  listSyncOperationEntityIds() {
    const statement = this.db.prepare("SELECT operation_json FROM sync_operations");

    try {
      const ids = [];
      while (statement.step()) {
        const operation = JSON.parse(String(statement.getAsObject().operation_json || "{}"));
        if (operation?.entityId) {
          ids.push(operation.entityId);
        }
      }
      return ids;
    } finally {
      statement.free();
    }
  }

  markSyncOperationsPushed(ids, pushedAt) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return 0;
    }

    const statement = this.db.prepare("UPDATE sync_operations SET pushed_at = ? WHERE id = ?");
    let changed = 0;
    try {
      for (const id of ids) {
        statement.run([pushedAt, id]);
        changed += this.db.getRowsModified();
      }
    } finally {
      statement.free();
    }

    if (changed > 0) {
      this.persist();
    }
    return changed;
  }

  hasAppliedSyncOperation(id) {
    const statement = this.db.prepare("SELECT id FROM applied_sync_operations WHERE id = ? LIMIT 1");
    try {
      statement.bind([id]);
      return statement.step();
    } finally {
      statement.free();
    }
  }

  markSyncOperationApplied(id, appliedAt) {
    this.db.run(
      "INSERT OR IGNORE INTO applied_sync_operations(id, applied_at) VALUES (?, ?)",
      [id, appliedAt]
    );
    const changed = this.db.getRowsModified();
    if (changed > 0) {
      this.persist();
    }
    return changed > 0;
  }

  applySyncOperation(operation, appliedAt) {
    if (!operation?.id || this.hasAppliedSyncOperation(operation.id)) {
      return false;
    }

    if (operation.type === "upsert_task" && operation.task) {
      this.upsertTask(operation.task);
      this.markSyncOperationApplied(operation.id, appliedAt);
      return true;
    }

    if (operation.type === "delete_task") {
      const existing = this.getTaskById(operation.entityId);
      if (existing && String(existing.updatedAt || "") > String(operation.createdAt || "")) {
        this.markSyncOperationApplied(operation.id, appliedAt);
        return false;
      }
      this.deleteTask(operation.entityId);
      this.markSyncOperationApplied(operation.id, appliedAt);
      return true;
    }

    return false;
  }

  close() {
    if (this.persistDirty) {
      this.persistDepth = 0;
      this.flushDeferredPersistence();
    }
    this.db.close();
  }
}

async function createSqliteMvpStorage(options) {
  const SQL = await getSqlModule();
  return new SqliteMvpStorage(SQL, options);
}

module.exports = {
  DEFAULT_DB_PATH,
  DEFAULT_SEED,
  SqliteMvpStorage,
  createSqliteMvpStorage,
  readMvpSeedFile,
};

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
    const exported = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(exported));
  }

  getSelectedDate() {
    const result = this.db.exec("SELECT value FROM settings WHERE key = 'selected_date'");
    return result[0]?.values?.[0]?.[0] ?? this.seed.selectedDate;
  }

  setSelectedDate(date) {
    this.db.run(
      "INSERT OR REPLACE INTO settings(key, value) VALUES ('selected_date', ?)",
      [date]
    );
    this.persist();
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

  close() {
    this.persist();
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

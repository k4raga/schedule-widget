"use strict";

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { fetchGoogleCalendarScheduleReadOnly } = require("../../google-sync");

const {
  ContractValidationError,
  normalizeCreateRecurringTaskSeriesCommand,
  normalizeCreateTaskCommand,
  normalizeDeleteTaskCommand,
  normalizeDayContextRequest,
  normalizeSetTaskStatusCommand,
  normalizeUpdateTaskCommand,
  todayDateKey,
} = require("../contracts");
const {
  createSqliteMvpStorage,
  DEFAULT_DB_PATH,
} = require("../storage-sqlite");

const DEFAULT_SEED_PATH = path.join(process.cwd(), "tests", "fixtures", "v2-mvp-seed.json");

function nowIso() {
  return new Date().toISOString();
}

const IGNORED_GOOGLE_EVENT_TITLES = new Set([
  "проверка тендеров",
  "проверка тендера",
]);

function normalizeExternalEventTitle(title) {
  return String(title || "")
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function shouldImportExternalEvent(event) {
  return !IGNORED_GOOGLE_EVENT_TITLES.has(normalizeExternalEventTitle(event?.title));
}

async function createV2MvpBackend(options = {}) {
  const storage =
    options.storage ||
    (await createSqliteMvpStorage({
      dbPath: options.dbPath || DEFAULT_DB_PATH,
      seedPath: options.seedPath || DEFAULT_SEED_PATH,
      seedData: options.seedData,
    }));
  const ownsStorage = !options.storage;
  const googleReadSyncAdapter =
    typeof options.googleReadSyncAdapter === "function"
      ? options.googleReadSyncAdapter
      : fetchGoogleCalendarScheduleReadOnly;

  function resolveContextDate(input) {
    const request = normalizeDayContextRequest(input);
    const date = request.date || storage.getSelectedDate() || todayDateKey();
    storage.setSelectedDate(date);
    return date;
  }

  return {
    async getDayContext(input = {}) {
      const date = resolveContextDate(input);
      const tasks = storage.listTasksByDate(date);
      const externalEvents = storage.listExternalEventsByDate(date);
      return { date, tasks, externalEvents };
    },

    async listTasksForDate(input = {}) {
      const date = resolveContextDate(input);
      return storage.listTasksByDate(date);
    },

    async createTask(input = {}) {
      const fallbackDate = storage.getSelectedDate() || todayDateKey();
      const command = normalizeCreateTaskCommand(input, fallbackDate);
      const timestamp = nowIso();

      const task = {
        id: randomUUID(),
        date: command.date,
        title: command.title,
        status: "todo",
        startTime: command.startTime,
        endTime: command.endTime,
        scope: command.scope,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      storage.createTask(task);
      storage.setSelectedDate(task.date);
      return task;
    },

    async createRecurringTaskSeries(input = {}) {
      const fallbackDate = storage.getSelectedDate() || todayDateKey();
      const command = normalizeCreateRecurringTaskSeriesCommand(input, fallbackDate);
      const timestamp = nowIso();
      const createdTasks = [];
      const skippedDates = [];

      command.dateKeys.forEach((dateKey) => {
        const dateTasks = storage.listTasksByDate(dateKey);
        const occupied = dateTasks.some(
          (task) => task.startTime === command.startTime && task.endTime === command.endTime
        );
        if (occupied) {
          skippedDates.push(dateKey);
          return;
        }

        createdTasks.push({
          id: randomUUID(),
          date: dateKey,
          title: command.title,
          status: "todo",
          startTime: command.startTime,
          endTime: command.endTime,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });

      storage.createTasks(createdTasks);
      storage.setSelectedDate(command.anchorDate);
      return {
        anchorDate: command.anchorDate,
        createdCount: createdTasks.length,
        skippedCount: skippedDates.length,
        createdTasks,
        skippedDates,
      };
    },

    async updateTask(input = {}) {
      const fallbackDate = storage.getSelectedDate() || todayDateKey();
      const command = normalizeUpdateTaskCommand(input, fallbackDate);
      const existing = storage.getTaskById(command.id);
      if (!existing) {
        throw new ContractValidationError("task does not exist", "id");
      }

      const updatedTask = {
        ...existing,
        date: command.date,
        title: command.title,
        scope: command.scope || existing.scope || "day",
        startTime: command.startTime,
        endTime: command.endTime,
        updatedAt: nowIso(),
      };

      storage.updateTask(updatedTask);
      storage.setSelectedDate(updatedTask.date);
      return updatedTask;
    },

    async deleteTask(input = {}) {
      const command = normalizeDeleteTaskCommand(input);
      const existing = storage.getTaskById(command.id);
      if (!existing) {
        throw new ContractValidationError("task does not exist", "id");
      }

      storage.deleteTask(command.id);
      storage.setSelectedDate(existing.date);
      return { id: command.id, deleted: true };
    },

    async setTaskStatus(input = {}) {
      const command = normalizeSetTaskStatusCommand(input);
      const existing = storage.getTaskById(command.id);
      if (!existing) {
        throw new ContractValidationError("task does not exist", "id");
      }

      const updatedAt = nowIso();
      storage.setTaskStatus(command.id, command.status, updatedAt);
      storage.setSelectedDate(existing.date);
      return {
        ...existing,
        status: command.status,
        updatedAt,
      };
    },

    async syncGoogleDayReadOnly(input = {}) {
      const date = resolveContextDate({ date: input?.date || input?.dateKey });
      const cwd = String(input?.cwd || process.cwd());
      const timeZone = String(input?.timeZone || "Europe/Moscow");
      const result = await googleReadSyncAdapter({
        cwd,
        targetDate: date,
        timeZone,
      });
      let importedCount = 0;

      if (result?.ok) {
        const timestamp = nowIso();
        const normalized = (Array.isArray(result.overlayEvents) ? result.overlayEvents : [])
          .filter(shouldImportExternalEvent)
          .map((event, index) => ({
            id: randomUUID(),
            date,
            title: String(event?.title || "").trim(),
            start: String(event?.start || "").trim(),
            end: String(event?.end || "").trim(),
            source: String(event?.source || "").trim() || "google-calendar",
            calendarId: String(event?.calendarId || "").trim() || `calendar-${index + 1}`,
            createdAt: timestamp,
            updatedAt: timestamp,
          }))
          .filter((event) => event.title && event.start && event.end);
        importedCount = normalized.length;
        storage.replaceExternalEventsByDate(date, normalized);
      }

      return {
        ok: Boolean(result?.ok),
        targetDate: date,
        checkedCalendars: Array.isArray(result?.checkedCalendars) ? result.checkedCalendars : [],
        importedCount,
        reason: String(result?.reason || ""),
        notes: String(result?.notes || ""),
      };
    },

    async close() {
      if (ownsStorage) {
        storage.close();
      }
    },

    ContractValidationError,
  };
}

module.exports = {
  createV2MvpBackend,
  DEFAULT_SEED_PATH,
};

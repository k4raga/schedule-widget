"use strict";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_TITLE_LENGTH = 200;
const MAX_SERIES_DATES = 62;
const TASK_STATUSES = new Set(["todo", "done"]);
const TASK_SCOPES = new Set(["day", "week"]);

class ContractValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ContractValidationError";
    this.code = "CONTRACT_VALIDATION_ERROR";
    this.field = field || null;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertIsoDate(value, fieldName) {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    throw new ContractValidationError(
      `${fieldName} must be a YYYY-MM-DD string`,
      fieldName
    );
  }

  const utcMidnight = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(utcMidnight.getTime())) {
    throw new ContractValidationError(`${fieldName} is invalid`, fieldName);
  }

  return value;
}

function assertOptionalTime(value, fieldName) {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string" || !TIME_RE.test(value)) {
    throw new ContractValidationError(
      `${fieldName} must be an HH:MM string or null`,
      fieldName
    );
  }
  return value;
}

function assertTitle(value) {
  if (typeof value !== "string") {
    throw new ContractValidationError("title must be a string", "title");
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ContractValidationError("title must not be empty", "title");
  }
  if (normalized.length > MAX_TITLE_LENGTH) {
    throw new ContractValidationError(
      `title must be <= ${MAX_TITLE_LENGTH} characters`,
      "title"
    );
  }
  return normalized;
}

function assertTaskId(value, fieldName = "id") {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ContractValidationError(`${fieldName} must be a non-empty string`, fieldName);
  }
  return value.trim();
}

function assertTaskStatus(value, fieldName = "status") {
  if (typeof value !== "string" || !TASK_STATUSES.has(value)) {
    throw new ContractValidationError(
      `${fieldName} must be one of: ${Array.from(TASK_STATUSES).join(", ")}`,
      fieldName
    );
  }
  return value;
}

function todayDateKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDayContextRequest(input) {
  if (input == null) {
    return { date: null };
  }
  if (!isPlainObject(input)) {
    throw new ContractValidationError(
      "day context request must be an object",
      "request"
    );
  }

  if (input.date == null) {
    return { date: null };
  }

  return { date: assertIsoDate(input.date, "date") };
}

function normalizeCreateTaskCommand(input, fallbackDate) {
  if (!isPlainObject(input)) {
    throw new ContractValidationError(
      "create task command must be an object",
      "request"
    );
  }

  const date = assertIsoDate(input.date ?? fallbackDate, "date");
  const title = assertTitle(input.title);
  const startTime = assertOptionalTime(input.startTime, "startTime");
  const endTime = assertOptionalTime(input.endTime, "endTime");
  const scope = input.scope == null ? "day" : String(input.scope).trim();
  if (!TASK_SCOPES.has(scope)) {
    throw new ContractValidationError("scope must be day or week", "scope");
  }

  if (startTime && endTime && endTime <= startTime) {
    throw new ContractValidationError(
      "endTime must be greater than startTime",
      "endTime"
    );
  }

  return { date, title, startTime, endTime, scope };
}

function normalizeUpdateTaskCommand(input, fallbackDate) {
  if (!isPlainObject(input)) {
    throw new ContractValidationError(
      "update task command must be an object",
      "request"
    );
  }

  const id = assertTaskId(input.id, "id");
  const date = assertIsoDate(input.date ?? fallbackDate, "date");
  const title = assertTitle(input.title);
  const startTime = assertOptionalTime(input.startTime, "startTime");
  const endTime = assertOptionalTime(input.endTime, "endTime");
  const scope = input.scope == null ? null : String(input.scope).trim();
  if (scope != null && !TASK_SCOPES.has(scope)) {
    throw new ContractValidationError("scope must be day or week", "scope");
  }

  if (startTime && endTime && endTime <= startTime) {
    throw new ContractValidationError(
      "endTime must be greater than startTime",
      "endTime"
    );
  }

  return { id, date, title, startTime, endTime, scope };
}

function normalizeCreateRecurringTaskSeriesCommand(input, fallbackDate) {
  if (!isPlainObject(input)) {
    throw new ContractValidationError(
      "create recurring task series command must be an object",
      "request"
    );
  }

  const anchorDate = assertIsoDate(input.anchorDate ?? fallbackDate, "anchorDate");
  const title = assertTitle(input.title);
  const startTime = assertOptionalTime(input.startTime, "startTime");
  const endTime = assertOptionalTime(input.endTime, "endTime");
  if (!startTime || !endTime) {
    throw new ContractValidationError(
      "startTime and endTime are required for recurring task series",
      !startTime ? "startTime" : "endTime"
    );
  }
  if (endTime <= startTime) {
    throw new ContractValidationError(
      "endTime must be greater than startTime",
      "endTime"
    );
  }

  if (!Array.isArray(input.dateKeys) || input.dateKeys.length === 0) {
    throw new ContractValidationError(
      "dateKeys must be a non-empty array",
      "dateKeys"
    );
  }
  if (input.dateKeys.length > MAX_SERIES_DATES) {
    throw new ContractValidationError(
      `dateKeys must contain <= ${MAX_SERIES_DATES} dates`,
      "dateKeys"
    );
  }

  const normalizedDates = [...new Set(input.dateKeys.map((value) => assertIsoDate(value, "dateKeys")))]
    .sort();

  if (!normalizedDates.includes(anchorDate)) {
    throw new ContractValidationError(
      "dateKeys must include anchorDate",
      "dateKeys"
    );
  }

  return {
    anchorDate,
    title,
    startTime,
    endTime,
    dateKeys: normalizedDates,
  };
}

function normalizeDeleteTaskCommand(input) {
  if (!isPlainObject(input)) {
    throw new ContractValidationError(
      "delete task command must be an object",
      "request"
    );
  }
  return { id: assertTaskId(input.id, "id") };
}

function normalizeSetTaskStatusCommand(input) {
  if (!isPlainObject(input)) {
    throw new ContractValidationError(
      "set task status command must be an object",
      "request"
    );
  }
  return {
    id: assertTaskId(input.id, "id"),
    status: assertTaskStatus(input.status, "status"),
  };
}

module.exports = {
  ContractValidationError,
  MAX_TITLE_LENGTH,
  assertIsoDate,
  normalizeCreateTaskCommand,
  normalizeCreateRecurringTaskSeriesCommand,
  normalizeDeleteTaskCommand,
  normalizeDayContextRequest,
  normalizeSetTaskStatusCommand,
  normalizeUpdateTaskCommand,
  todayDateKey,
};

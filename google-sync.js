const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const CODEX_PATH_ENV = "WATSON_DESK_CODEX_PATH";

const GOOGLE_CALENDAR_APP_ID = "connector_947e0d954944416db111db556030eea6";
const GOOGLE_CALENDAR_APP_PATH = `app://${GOOGLE_CALENDAR_APP_ID}`;
const GOOGLE_CALENDAR_MODEL = "gpt-5.4-mini";
const GOOGLE_CALENDAR_READ_TIMEOUT_MS = 120000;
const GOOGLE_CALENDAR_IDS = {
  primary: "primary",
  work: "3def21724634cc82d171f8c8028fb088f842e2b4cc8f9aa524ad3b2b09d5ad9a@group.calendar.google.com",
  family: "family07350484591066757327@group.calendar.google.com",
};

const DEFAULT_LEGACY_SLOT_TITLES = [
  "Рабочий слот",
  "Навык",
  "Свободный день",
  "Обучение",
  "Наука",
  "Проверка тендеров",
];

function buildEmptyResult(targetDate, extra = {}) {
  return {
    ok: false,
    reason: "",
    targetDate,
    checkedCalendars: ["primary", "work", "family"],
    overlayEvents: [],
    syncedTasks: [],
    skippedTasks: [],
    deletedLegacyEvents: [],
    notes: "",
    ...extra,
  };
}

function sanitizeTask(task) {
  return {
    id: String(task?.id || "").trim(),
    title: String(task?.title || "").trim(),
    notes: String(task?.notes || "").trim(),
    dueDate: String(task?.dueDate || "").trim(),
    startTime: String(task?.startTime || "").trim(),
    endTime: String(task?.endTime || "").trim(),
    slotTitle: String(task?.slotTitle || "").trim(),
    calendarMode: task?.calendarMode === "google" ? "google" : "local",
    recurring: Boolean(task?.recurring),
    status: task?.status === "done" ? "done" : "active",
  };
}

function isClockValue(value) {
  return /^\d{2}:\d{2}$/.test(String(value || "").trim());
}

function uniqueStrings(items) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()))];
}

function computeSyncCandidates(tasks, targetDate, legacySlotTitles) {
  const skippedTasks = [];
  const syncableTasks = [];

  (tasks || []).map(sanitizeTask).forEach((task) => {
    if (task.calendarMode !== "google") {
      return;
    }

    if (task.status === "done") {
      skippedTasks.push({
        taskId: task.id,
        title: task.title,
        reason: "done_task",
      });
      return;
    }

    if (task.dueDate !== targetDate) {
      return;
    }

    if (!task.title) {
      skippedTasks.push({
        taskId: task.id,
        title: "",
        reason: "missing_title",
      });
      return;
    }

    if (!isClockValue(task.startTime) || !isClockValue(task.endTime)) {
      skippedTasks.push({
        taskId: task.id,
        title: task.title,
        reason: "missing_time_range",
      });
      return;
    }

    syncableTasks.push({
      id: task.id,
      title: task.title,
      notes: task.notes,
      startTime: task.startTime,
      endTime: task.endTime,
      slotTitle: task.slotTitle,
      recurring: task.recurring,
    });
  });

  return {
    syncableTasks,
    skippedTasks,
  };
}

function normalizeOverlayEvents(events) {
  const normalized = [];
  const seen = new Set();

  (events || []).forEach((event) => {
    const title = String(event?.title || "").trim();
    const start = String(event?.start || "").trim();
    const end = String(event?.end || "").trim();
    const source = String(event?.source || "").trim();
    const calendarId = String(event?.calendarId || "").trim();
    if (!title || !isClockValue(start) || !isClockValue(end)) {
      return;
    }
    const key = `${title}|${start}|${end}|${source}|${calendarId}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push({
      title,
      start,
      end,
      source,
      calendarId,
    });
  });

  normalized.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start.localeCompare(right.start);
    }
    if (left.end !== right.end) {
      return left.end.localeCompare(right.end);
    }
    return left.title.localeCompare(right.title);
  });

  return normalized;
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fenced?.[1] || raw;

  try {
    return JSON.parse(candidate);
  } catch (error) {
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (error) {
    }
  }

  return null;
}

function createOutputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "ok",
      "reason",
      "targetDate",
      "checkedCalendars",
      "overlayEvents",
      "syncedTasks",
      "skippedTasks",
      "deletedLegacyEvents",
      "notes",
    ],
    properties: {
      ok: { type: "boolean" },
      reason: { type: "string" },
      targetDate: { type: "string" },
      checkedCalendars: {
        type: "array",
        items: { type: "string" },
      },
      overlayEvents: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "start", "end", "source", "calendarId"],
          properties: {
            title: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            source: { type: "string" },
            calendarId: { type: "string" },
          },
        },
      },
      syncedTasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["taskId", "title", "start", "end", "calendarId", "action"],
          properties: {
            taskId: { type: "string" },
            title: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            calendarId: { type: "string" },
            action: { type: "string" },
          },
        },
      },
      skippedTasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["taskId", "title", "reason"],
          properties: {
            taskId: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      deletedLegacyEvents: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["calendarId", "eventId", "title"],
          properties: {
            calendarId: { type: "string" },
            eventId: { type: "string" },
            title: { type: "string" },
          },
        },
      },
      notes: { type: "string" },
    },
  };
}

function buildTurnPrompt({ targetDate, syncableTasks, skippedTasks, legacySlotTitles, timeZone }) {
  return [
    `Use [$google-calendar](${GOOGLE_CALENDAR_APP_PATH}).`,
    "You are syncing Watson Desk with Google Calendar.",
    `Target date: ${targetDate}. Time zone: ${timeZone}.`,
    "You must use the Google Calendar connector tools. If connector access fails or any required calendar is inaccessible, return ok=false with an honest reason. Do not return ok=true without real tool access.",
    "Calendars to inspect:",
    `- primary: ${GOOGLE_CALENDAR_IDS.primary}`,
    `- work (Bitrix24): ${GOOGLE_CALENDAR_IDS.work}`,
    `- family: ${GOOGLE_CALENDAR_IDS.family}`,
    "Sync rules:",
    "1. Read events from all three calendars on the target date.",
    "2. overlayEvents must include only external calendar events that the widget should show. Do not include widget-managed tasks and do not include deleted legacy slot events.",
    `3. In primary, delete legacy slot events on the target date if their title exactly matches one of these titles: ${JSON.stringify(uniqueStrings(legacySlotTitles))}. These are stale aggregated work-area events and should not remain in Google Calendar.`,
    "4. Sync only Watson Desk tasks with calendarMode=google into primary. Do not create or update aggregated work-area slots.",
    "5. For each synced task, put marker [watson-task:<taskId>] into the event description so future syncs can update the same event without duplicates.",
    "6. If a primary event already has the same marker, update it. Otherwise, if an event with the same title/start/end already exists on the target date, reuse or update it instead of creating a duplicate.",
    "7. Do not create calendar events from aggregated slots; sync only the explicit tasks from 'Tasks to sync'.",
    "8. checkedCalendars must be exactly [\"primary\",\"work\",\"family\"].",
    `Tasks to sync: ${JSON.stringify(syncableTasks)}`,
    `Tasks already skipped locally and should stay skipped: ${JSON.stringify(skippedTasks)}`,
    "Return only JSON matching the output schema.",
  ].join("\n");
}

function normalizeCandidatePath(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function isResolvableCodexPath(filePath) {
  const normalized = normalizeCandidatePath(filePath);
  if (!normalized || !fs.existsSync(normalized)) {
    return false;
  }

  try {
    if (!fs.statSync(normalized).isFile()) {
      return false;
    }
  } catch (error) {
    return false;
  }

  const baseName = path.basename(normalized).toLowerCase();
  return baseName === "codex" || baseName === "codex.exe";
}

function uniquePaths(items) {
  const seen = new Set();
  const result = [];

  (items || []).forEach((item) => {
    const candidate = normalizeCandidatePath(item);
    if (!candidate) {
      return;
    }

    const key = process.platform === "win32" ? candidate.toLowerCase() : candidate;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(candidate);
  });

  return result;
}

function collectCodexCandidatesFromPathEnv() {
  const pathValue = String(process.env.PATH || "");
  if (!pathValue) {
    return [];
  }

  const candidates = [];
  pathValue
    .split(path.delimiter)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      candidates.push(path.join(segment, "codex.exe"));
      candidates.push(path.join(segment, "codex"));
    });

  return candidates;
}

function collectCodexCandidatesFromWhere() {
  const candidates = [];
  for (const command of ["codex", "codex.exe"]) {
    try {
      const output = execFileSync("where.exe", [command], {
        encoding: "utf8",
        windowsHide: true,
      });
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => candidates.push(line));
    } catch (error) {
    }
  }
  return candidates;
}

function collectCodexCandidatesFromPowerShell() {
  const candidates = [];
  for (const command of ["codex", "codex.exe"]) {
    try {
      const output = execFileSync(
        "powershell.exe",
        ["-NoProfile", "-Command", `(Get-Command ${command} -ErrorAction Stop).Source`],
        {
          encoding: "utf8",
          windowsHide: true,
        },
      );
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => candidates.push(line));
    } catch (error) {
    }
  }
  return candidates;
}

function collectKnownCodexInstallPaths() {
  const localAppData = String(process.env.LOCALAPPDATA || "").trim();
  const appData = String(process.env.APPDATA || "").trim();
  const programFiles = String(process.env.ProgramFiles || "").trim();
  const known = [
    localAppData ? path.join(localAppData, "OpenAI", "Codex", "bin", "codex.exe") : "",
    localAppData ? path.join(localAppData, "OpenAI", "Codex", "bin", "codex") : "",
    localAppData ? path.join(localAppData, "Microsoft", "WindowsApps", "codex.exe") : "",
    localAppData ? path.join(localAppData, "Microsoft", "WindowsApps", "codex") : "",
    appData ? path.join(appData, "npm", "codex.cmd") : "",
  ];
  if (process.platform === "win32" && programFiles) {
    try {
      fs.readdirSync(path.join(programFiles, "WindowsApps"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("OpenAI.Codex_"))
        .sort((left, right) => right.name.localeCompare(left.name))
        .forEach((entry) => {
          known.push(path.join(programFiles, "WindowsApps", entry.name, "app", "resources", "codex.exe"));
          known.push(path.join(programFiles, "WindowsApps", entry.name, "app", "resources", "codex"));
        });
    } catch (error) {
    }
  }
  return known.filter(Boolean);
}

function resolveCodexSourcePath() {
  const explicit = normalizeCandidatePath(process.env[CODEX_PATH_ENV]);
  const candidates = uniquePaths([
    explicit,
    ...collectCodexCandidatesFromPathEnv(),
    ...collectCodexCandidatesFromWhere(),
    ...collectCodexCandidatesFromPowerShell(),
    ...collectKnownCodexInstallPaths(),
  ]);
  const resolved = candidates.find(isResolvableCodexPath);
  if (resolved) {
    return resolved;
  }

  const note = explicit
    ? `Provided ${CODEX_PATH_ENV} path was not usable: ${explicit}.`
    : `${CODEX_PATH_ENV} is not set.`;
  throw new Error(
    `Codex CLI executable not found. ${note} Set ${CODEX_PATH_ENV} to the full path of codex.exe.`,
  );
}

function resolveRunnableCodexBinary() {
  const sourcePath = resolveCodexSourcePath();
  const targetPath = path.join(os.tmpdir(), "watson-desk-codex-app-server.exe");

  try {
    fs.copyFileSync(sourcePath, targetPath);
  } catch (error) {
    if (!fs.existsSync(targetPath)) {
      throw error;
    }
  }

  return targetPath;
}

function createTempJsonFile(prefix, value) {
  const filePath = path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
  fs.writeFileSync(filePath, JSON.stringify(value), "utf8");
  return filePath;
}

function cleanupTempFiles(filePaths) {
  filePaths.forEach((filePath) => {
    if (!filePath) {
      return;
    }
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
    }
  });
}

function terminateChildProcess(child) {
  if (!child || !child.pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      return;
    }
  } catch (error) {
  }

  try {
    child.kill();
  } catch (error) {
  }
}

function summarizeExecFailure(message) {
  const normalized = String(message || "").trim();
  if (!normalized) {
    return {
      reason: "google_calendar_sync_failed",
      notes: "Google Calendar sync failed.",
    };
  }

  if (/usage limit/i.test(normalized)) {
    const retryMatch = normalized.match(/try again at ([^.\r\n]+)/i);
    const retryAt = retryMatch?.[1] ? ` Try again at ${retryMatch[1]}.` : "";
    return {
      reason: "google_calendar_rate_limited",
      notes: `Codex usage limit reached while running Google Calendar sync.${retryAt}`.trim(),
    };
  }

  if (/connector access fails|connector unavailable|inaccessible/i.test(normalized)) {
    return {
      reason: "google_calendar_unavailable",
      notes: "Google Calendar connector is unavailable in the current Codex session.",
    };
  }

  if (/Codex CLI executable not found|WATSON_DESK_CODEX_PATH/i.test(normalized)) {
    return {
      reason: "google_calendar_sync_failed",
      notes: "Codex CLI is not available for sync. Set WATSON_DESK_CODEX_PATH to codex.exe.",
    };
  }

  if (/timed out/i.test(normalized)) {
    return {
      reason: "google_calendar_read_timeout",
      notes: "Google Calendar read timed out before Codex returned calendar data. Try again, or use a shorter manual import path.",
    };
  }

  return {
    reason: "google_calendar_sync_failed",
    notes: normalized,
  };
}

function runSyncCommand({ cwd, targetDate, syncableTasks, skippedTasks, legacySlotTitles, timeZone }) {
  const codexBinary = resolveRunnableCodexBinary();
  const schemaPath = createTempJsonFile("watson-sync-schema", createOutputSchema());
  const outputPath = path.join(
    os.tmpdir(),
    `watson-sync-output-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
  const prompt = buildTurnPrompt({
    targetDate,
    syncableTasks,
    skippedTasks,
    legacySlotTitles,
    timeZone,
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutId = null;

    const finish = (handler) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      try {
        handler();
      } finally {
        cleanupTempFiles([schemaPath, outputPath]);
      }
    };

    const child = spawn(
      codexBinary,
      [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--color",
        "never",
        "-c",
        "reasoning_effort=\"low\"",
        "-m",
        GOOGLE_CALENDAR_MODEL,
        "-s",
        "read-only",
        "--output-schema",
        schemaPath,
        "-o",
        outputPath,
        "-C",
        cwd,
        "-",
      ],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    timeoutId = setTimeout(() => {
      terminateChildProcess(child);
      finish(() => reject(new Error(`codex exec timed out after ${GOOGLE_CALENDAR_READ_TIMEOUT_MS} ms.`)));
    }, GOOGLE_CALENDAR_READ_TIMEOUT_MS);

    child.on("error", (error) => {
      finish(() => reject(error));
    });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (status) => {
      finish(() => {
        const rawOutput = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

        if (status !== 0 && !rawOutput) {
          reject(new Error(stderr.trim() || stdout.trim() || `codex exec failed with exit code ${status}.`));
          return;
        }

        resolve({
          parsed: extractJsonObject(rawOutput),
          stdout,
          stderr,
          status,
        });
      });
    });

    child.stdin.on("error", () => {
    });
    child.stdin.end(prompt, "utf8");
  });
}

function finalizeTurnResult(targetDate, runResult, skippedTasks) {
  const parsed = runResult?.parsed;
  if (!parsed) {
    return buildEmptyResult(targetDate, {
      reason: "invalid_agent_json",
      skippedTasks,
      notes: "Google Calendar turn completed without valid JSON payload.",
    });
  }

  const result = buildEmptyResult(targetDate, {
    ...parsed,
    targetDate: parsed.targetDate || targetDate,
    checkedCalendars: Array.isArray(parsed.checkedCalendars) && parsed.checkedCalendars.length
      ? parsed.checkedCalendars
      : ["primary", "work", "family"],
    overlayEvents: normalizeOverlayEvents(parsed.overlayEvents),
    syncedTasks: Array.isArray(parsed.syncedTasks) ? parsed.syncedTasks : [],
    skippedTasks: Array.isArray(parsed.skippedTasks) ? parsed.skippedTasks : skippedTasks,
    deletedLegacyEvents: Array.isArray(parsed.deletedLegacyEvents) ? parsed.deletedLegacyEvents : [],
    notes: String(parsed.notes || ""),
    reason: String(parsed.reason || ""),
    ok: Boolean(parsed.ok),
  });

  const toolTranscript = `${String(runResult?.stdout || "")}\n${String(runResult?.stderr || "")}`;
  const connectorUsed = /mcp:\s+codex_apps\/google calendar_/i.test(toolTranscript);
  if (result.ok && !connectorUsed) {
    return buildEmptyResult(targetDate, {
      reason: "google_calendar_unverified",
      skippedTasks: result.skippedTasks,
      notes: "Google Calendar sync returned ok=true without verified Google Calendar tool activity.",
    });
  }

  return result;
}

async function syncGoogleCalendar({
  cwd,
  targetDate,
  tasks,
  legacySlotTitles = DEFAULT_LEGACY_SLOT_TITLES,
  timeZone = "Europe/Moscow",
}) {
  const normalizedLegacyTitles = uniqueStrings(legacySlotTitles);
  const { syncableTasks, skippedTasks } = computeSyncCandidates(tasks, targetDate, normalizedLegacyTitles);
  const emptyResult = buildEmptyResult(targetDate, {
    skippedTasks,
  });

  try {
    const runResult = await runSyncCommand({
      cwd,
      targetDate,
      syncableTasks,
      skippedTasks,
      legacySlotTitles: normalizedLegacyTitles,
      timeZone,
    });

    return finalizeTurnResult(targetDate, runResult, skippedTasks);
  } catch (error) {
    const message = error?.message || String(error);
    const summarized = summarizeExecFailure(message);
    return {
      ...emptyResult,
      reason: summarized.reason,
      notes: summarized.notes,
    };
  }
}

function buildReadOnlyEmptyResult(targetDate, extra = {}) {
  return {
    ok: false,
    reason: "",
    targetDate,
    checkedCalendars: ["primary", "work", "family"],
    overlayEvents: [],
    notes: "",
    ...extra,
  };
}

function createReadOnlyScheduleSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "ok",
      "reason",
      "targetDate",
      "checkedCalendars",
      "overlayEvents",
      "notes",
    ],
    properties: {
      ok: { type: "boolean" },
      reason: { type: "string" },
      targetDate: { type: "string" },
      checkedCalendars: {
        type: "array",
        items: { type: "string" },
      },
      overlayEvents: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "start", "end", "source", "calendarId"],
          properties: {
            title: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
            source: { type: "string" },
            calendarId: { type: "string" },
          },
        },
      },
      notes: { type: "string" },
    },
  };
}

function buildReadOnlySchedulePrompt({ targetDate, timeZone }) {
  return [
    `Use [$google-calendar](${GOOGLE_CALENDAR_APP_PATH}).`,
    "You fetch a read-only day schedule for Watson Desk v2.",
    `Target date: ${targetDate}. Time zone: ${timeZone}.`,
    "You must only read Google Calendar data.",
    "Do not create, update, or delete any Google events.",
    "Calendars to inspect:",
    `- primary: ${GOOGLE_CALENDAR_IDS.primary}`,
    `- work (Bitrix24): ${GOOGLE_CALENDAR_IDS.work}`,
    `- family: ${GOOGLE_CALENDAR_IDS.family}`,
    "Return events from those calendars on target date as overlayEvents.",
    "overlayEvents item format: { title, start, end, source, calendarId } with start/end in HH:MM.",
    "Exclude all-day items and items without a concrete time range.",
    "checkedCalendars must be exactly [\"primary\",\"work\",\"family\"].",
    "If connector access fails or read is unavailable, return ok=false with honest reason.",
    "Return only JSON matching the output schema.",
  ].join("\n");
}

function runReadOnlyScheduleCommand({ cwd, targetDate, timeZone }) {
  const codexBinary = resolveRunnableCodexBinary();
  const schemaPath = createTempJsonFile("watson-read-sync-schema", createReadOnlyScheduleSchema());
  const outputPath = path.join(
    os.tmpdir(),
    `watson-read-sync-output-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );
  const prompt = buildReadOnlySchedulePrompt({
    targetDate,
    timeZone,
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutId = null;

    const finish = (handler) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      try {
        handler();
      } finally {
        cleanupTempFiles([schemaPath, outputPath]);
      }
    };

    const child = spawn(
      codexBinary,
      [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--color",
        "never",
        "-c",
        "reasoning_effort=\"low\"",
        "-m",
        GOOGLE_CALENDAR_MODEL,
        "-s",
        "read-only",
        "--output-schema",
        schemaPath,
        "-o",
        outputPath,
        "-C",
        cwd,
        "-",
      ],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    timeoutId = setTimeout(() => {
      terminateChildProcess(child);
      finish(() => reject(new Error(`codex exec timed out after ${GOOGLE_CALENDAR_READ_TIMEOUT_MS} ms.`)));
    }, GOOGLE_CALENDAR_READ_TIMEOUT_MS);

    child.on("error", (error) => {
      finish(() => reject(error));
    });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (status) => {
      finish(() => {
        const rawOutput = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

        if (status !== 0 && !rawOutput) {
          reject(new Error(stderr.trim() || stdout.trim() || `codex exec failed with exit code ${status}.`));
          return;
        }

        resolve({
          parsed: extractJsonObject(rawOutput),
          stdout,
          stderr,
          status,
        });
      });
    });

    child.stdin.on("error", () => {
    });
    child.stdin.end(prompt, "utf8");
  });
}

function finalizeReadOnlyScheduleResult(targetDate, runResult) {
  const parsed = runResult?.parsed;
  if (!parsed) {
    return buildReadOnlyEmptyResult(targetDate, {
      reason: "invalid_agent_json",
      notes: "Google Calendar read-only sync completed without valid JSON payload.",
    });
  }

  const result = buildReadOnlyEmptyResult(targetDate, {
    ...parsed,
    targetDate: parsed.targetDate || targetDate,
    checkedCalendars: Array.isArray(parsed.checkedCalendars) && parsed.checkedCalendars.length
      ? parsed.checkedCalendars
      : ["primary", "work", "family"],
    overlayEvents: normalizeOverlayEvents(parsed.overlayEvents),
    notes: String(parsed.notes || ""),
    reason: String(parsed.reason || ""),
    ok: Boolean(parsed.ok),
  });

  const toolTranscript = `${String(runResult?.stdout || "")}\n${String(runResult?.stderr || "")}`;
  const connectorUsed = /mcp:\s+codex_apps\/google calendar_/i.test(toolTranscript);
  if (result.ok && !connectorUsed) {
    return buildReadOnlyEmptyResult(targetDate, {
      reason: "google_calendar_unverified",
      notes: "Google Calendar read returned ok=true without verified Google Calendar tool activity.",
    });
  }

  return result;
}

async function fetchGoogleCalendarScheduleReadOnly({
  cwd,
  targetDate,
  timeZone = "Europe/Moscow",
}) {
  const emptyResult = buildReadOnlyEmptyResult(targetDate);

  try {
    const runResult = await runReadOnlyScheduleCommand({
      cwd,
      targetDate,
      timeZone,
    });

    return finalizeReadOnlyScheduleResult(targetDate, runResult);
  } catch (error) {
    const message = error?.message || String(error);
    const summarized = summarizeExecFailure(message);
    return {
      ...emptyResult,
      reason: summarized.reason,
      notes: summarized.notes,
    };
  }
}

module.exports = {
  DEFAULT_LEGACY_SLOT_TITLES,
  GOOGLE_CALENDAR_IDS,
  fetchGoogleCalendarScheduleReadOnly,
  syncGoogleCalendar,
};

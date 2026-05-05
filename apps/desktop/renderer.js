(function bootstrapRenderer() {
  const api = window.v2DesktopAPI;
  const helpers = window.ScheduleWidgetHelpers || {};

  const dom = {
    clock: document.getElementById("clock"),
    dockButton: document.getElementById("dockButton"),
    syncButton: document.getElementById("syncButton"),
    dbSyncButton: document.getElementById("dbSyncButton"),
    prevDayButton: document.getElementById("prevDayButton"),
    nextDayButton: document.getElementById("nextDayButton"),
    dateButton: document.getElementById("dateButton"),
    dateNav: document.querySelector(".date-nav"),
    dateInput: document.getElementById("dateInput"),
    dateLabel: document.getElementById("dateLabel"),
    content: document.getElementById("content"),
    stats: document.getElementById("stats"),
    statusLine: document.getElementById("statusLine"),
  };

  const BASE_EVENTS = [
    { title: "Турники + душ + завтрак", start: "07:30", end: "09:00", taskable: false },
    { title: "Планирование дня + запуск спринта", start: "09:00", end: "10:00", taskable: true },
    { title: "Развитие: личные задачи", start: "10:00", end: "11:00", taskable: true },
    { title: "Развитие: личные задачи", start: "11:00", end: "12:00", taskable: true },
    { title: "Развитие: личные задачи", start: "12:00", end: "13:00", taskable: true },
    { title: "Рабочий слот", start: "13:00", end: "14:00", taskable: true },
    { title: "Рабочий слот", start: "14:00", end: "15:00", taskable: true },
    { title: "Рабочий слот", start: "15:00", end: "16:00", taskable: true },
    { title: "Готовка и уборка", start: "16:00", end: "17:00", taskable: true },
    { title: "Поесть", start: "17:00", end: "18:00", taskable: false },
    { title: "Стрим", start: "18:00", end: "22:00", taskable: false },
    { title: "Ужин + отчет", start: "22:00", end: "22:30", taskable: false },
    { title: "Сон", start: "22:30", end: "07:30", taskable: false },
  ];

  const BASE_SATURDAY = [
    { title: "Подъем", start: "09:00", end: "09:30", taskable: false },
    { title: "Свободный день", start: "09:30", end: "18:00", taskable: true },
    { title: "CS2 по желанию", start: "18:00", end: "22:00", taskable: false },
    { title: "Сон", start: "23:30", end: "07:30", taskable: false },
  ];

  const BASE_SUNDAY = [
    { title: "Подъем", start: "09:00", end: "09:30", taskable: false },
    { title: "Свободный день", start: "09:30", end: "18:00", taskable: true },
    { title: "CS2 по желанию", start: "18:00", end: "21:00", taskable: false },
    { title: "Итоги недели", start: "21:00", end: "22:00", taskable: false },
    { title: "Сон", start: "23:30", end: "07:30", taskable: false },
  ];

  const NOTE_SLOTS = [
    { title: "\u0410\u0440\u043c\u043e\u0440\u0438 \u00b7 30 \u043c\u0438\u043d", source: "\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430", fixed: true },
    { title: "\u041d\u0430\u0432\u044b\u043a \u00b7 30 \u043c\u0438\u043d", source: "\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430", fixed: true },
    { title: "\u041f\u043b\u0430\u043d \u043d\u0430 \u0443\u0442\u0440\u043e", source: "\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430", fixed: true },
    { title: "\u0428\u043e\u0440\u0442\u0441", source: "\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430", fixed: true },
    { title: "\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0439 \u0441\u043b\u043e\u0442", source: "\u0417\u0430\u043c\u0435\u0442\u043a\u0430" },
    { title: "\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0439 \u0441\u043b\u043e\u0442", source: "\u0417\u0430\u043c\u0435\u0442\u043a\u0430" },
    { title: "\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0439 \u0441\u043b\u043e\u0442", source: "\u0417\u0430\u043c\u0435\u0442\u043a\u0430" },
  ];

  const WORK_GOOGLE_CALENDAR_ID = "3def21724634cc82d171f8c8028fb088f842e2b4cc8f9aa524ad3b2b09d5ad9a@group.calendar.google.com";

  let selectedDateKey = todayDateKey();
  let loadedTasks = [];
  let loadedWeeklyTasks = [];
  let currentContext = null;
  let focusTimerState = null;
  let lastLiveMinuteKey = null;
  let composerState = null;
  let weeklyComposerState = null;
  let syncInFlight = false;
  let dbSyncInFlight = false;
  let segmentModelsById = new Map();
  const slotOverrides = new Map();
  const calendarState = {
    isOpen: false,
    viewYear: null,
    viewMonth: null,
  };

  if (dom.dateNav && !document.getElementById("datePopover")) {
    const calendarRoot = document.createElement("div");
    calendarRoot.id = "datePopover";
    calendarRoot.className = "date-popover";
    calendarRoot.hidden = true;
    dom.dateNav.append(calendarRoot);
  }
  dom.datePopover = document.getElementById("datePopover");

  function now() {
    return new Date();
  }

  function todayDateKey() {
    const current = now();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    return `${current.getFullYear()}-${month}-${day}`;
  }

  function parseDateKey(dateKey) {
    if (!dateKey) {
      return null;
    }
    const parsed = new Date(`${dateKey}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function compareDateKeys(left, right) {
    const leftDate = parseDateKey(left);
    const rightDate = parseDateKey(right);
    if (!leftDate || !rightDate) {
      return 0;
    }
    return leftDate.getTime() - rightDate.getTime();
  }

  function shiftDateKey(dateKey, offsetDays) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return dateKey;
    }
    parsed.setDate(parsed.getDate() + offsetDays);
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${parsed.getFullYear()}-${month}-${day}`;
  }

  function weekStartDateKey(dateKey) {
    return helpers.weekStartDateKey ? helpers.weekStartDateKey(dateKey) : dateKey;
  }

  function weekEndDateKey(dateKey) {
    return helpers.weekEndDateKey ? helpers.weekEndDateKey(dateKey) : shiftDateKey(weekStartDateKey(dateKey), 6);
  }

  function weeklySlotRange(slotIndex) {
    return helpers.weeklySlotRange
      ? helpers.weeklySlotRange(slotIndex)
      : { startTime: "00:00", endTime: "00:01" };
  }

  function weeklyTaskForSlot(slotIndex) {
    return helpers.findWeeklyTaskForSlot
      ? helpers.findWeeklyTaskForSlot(loadedWeeklyTasks, slotIndex)
      : null;
  }

  function taskScope(task) {
    return helpers.taskScope ? helpers.taskScope(task) : "day";
  }

  function parseTaskListResponse(response) {
    return helpers.parseTaskListResponse ? helpers.parseTaskListResponse(response) : [];
  }

  function sortWeeklyTasks(tasks) {
    return helpers.sortWeeklyTasks ? helpers.sortWeeklyTasks(tasks, NOTE_SLOTS.length) : [];
  }

  function monthEndDateKey(dateKey) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return dateKey;
    }
    const monthEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0);
    return toDateKey(monthEnd);
  }

  function formatUiDate(dateKey) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return dateKey || "--";
    }
    return new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "long",
    }).format(parsed);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function syncCalendarViewToSelected() {
    const parsed = parseDateKey(selectedDateKey) || now();
    calendarState.viewYear = parsed.getFullYear();
    calendarState.viewMonth = parsed.getMonth();
  }

  function renderCalendarPopover() {
    if (!dom.datePopover) {
      return;
    }

    if (!calendarState.isOpen) {
      dom.datePopover.hidden = true;
      dom.datePopover.classList.remove("is-open");
      dom.datePopover.innerHTML = "";
      return;
    }

    if (!Number.isInteger(calendarState.viewYear) || !Number.isInteger(calendarState.viewMonth)) {
      syncCalendarViewToSelected();
    }

    const viewDate = new Date(calendarState.viewYear, calendarState.viewMonth, 1);
    const monthStartWeekday = (viewDate.getDay() + 6) % 7;
    const gridStart = new Date(viewDate);
    gridStart.setDate(viewDate.getDate() - monthStartWeekday);
    const selectedKey = selectedDateKey;
    const todayKeyValue = todayDateKey();

    const monthLabel = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(viewDate);

    const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
    const weekdays = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const day = new Date(2026, 0, 5 + dayIndex);
      weekdays.push(weekdayFormatter.format(day).slice(0, 2));
    }

    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = toDateKey(date);
      const classes = ["calendar-day"];
      if (date.getMonth() !== viewDate.getMonth()) {
        classes.push("is-outside");
      }
      if (dateKey === selectedKey) {
        classes.push("is-selected");
      }
      if (dateKey === todayKeyValue) {
        classes.push("is-today");
      }
      cells.push(
        `<button class="${classes.join(" ")}" type="button" data-calendar-date="${dateKey}">${date.getDate()}</button>`
      );
    }

    dom.datePopover.hidden = false;
    dom.datePopover.classList.add("is-open");
    dom.datePopover.innerHTML = `
      <div class="calendar-popover-shell" data-calendar-root>
        <div class="calendar-head">
          <button class="calendar-nav-btn" type="button" data-calendar-nav="-1" aria-label="Предыдущий месяц">‹</button>
          <div class="calendar-month">${monthLabel}</div>
          <button class="calendar-nav-btn" type="button" data-calendar-nav="1" aria-label="Следующий месяц">›</button>
        </div>
        <div class="calendar-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="calendar-grid">${cells.join("")}</div>
      </div>
    `;
  }

  function closeCalendarPopover() {
    if (!calendarState.isOpen) {
      return;
    }
    calendarState.isOpen = false;
    renderCalendarPopover();
  }

  function parseMinutes(value) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
      return null;
    }
    const [hours, minutes] = value.split(":");
    return Number(hours) * 60 + Number(minutes);
  }

  function formatMinutes(value) {
    const minutes = ((value % 1440) + 1440) % 1440;
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    return `${hours}:${mins}`;
  }

  function formatTimerMarkup(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return `00<span class="sep">:</span>00<span class="sep">:</span>00`;
    }
    const seconds = Math.floor(totalSeconds);
    const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hours}<span class="sep">:</span>${minutes}<span class="sep">:</span>${secs}`;
  }

  function updateClock() {
    const current = now();
    dom.clock.textContent = current.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  function currentMinuteKey() {
    const current = now();
    return `${todayDateKey()}-${current.getHours()}-${current.getMinutes()}`;
  }

  function setStatus(message, tone = "neutral") {
    dom.statusLine.textContent = message;
    dom.statusLine.classList.toggle("is-error", tone === "error");
    dom.statusLine.classList.toggle("is-success", tone === "success");
    dom.statusLine.classList.toggle("is-busy", tone === "busy");
  }

  function isToday(dateKey) {
    return dateKey === todayDateKey();
  }

  function isBrowseMode(dateKey) {
    return !isToday(dateKey);
  }

  function timeToEpochMs(dateKey, timeValue) {
    if (!dateKey || typeof timeValue !== "string" || !/^\d{2}:\d{2}$/.test(timeValue)) {
      return null;
    }
    const target = new Date(`${dateKey}T${timeValue}:00`);
    return Number.isNaN(target.getTime()) ? null : target.getTime();
  }

  function updateFocusTimer() {
    const digits = document.getElementById("timerDigits");
    if (!digits || !focusTimerState || !Number.isFinite(focusTimerState.targetAtMs)) {
      return;
    }
    const diffSeconds = Math.floor((focusTimerState.targetAtMs - Date.now()) / 1000);
    digits.innerHTML = formatTimerMarkup(diffSeconds);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function eventToneClass(title) {
    const normalized = String(title || "").toLowerCase();
    if (normalized.includes("рабочий слот")) return "tone-work";
    if (normalized.includes("развитие") || normalized.includes("навык")) return "tone-skill";
    if (normalized.includes("турники") || normalized.includes("планирование")) return "tone-blue";
    if (normalized.includes("стрим")) return "tone-stream";
    if (
      normalized.includes("готовка")
      || normalized.includes("уборка")
      || normalized.includes("поесть")
      || normalized.includes("ужин")
      || normalized.includes("отчет")
      || normalized.includes("отчёт")
    ) return "tone-evening";
    if (normalized.includes("сон")) return "tone-sleep";
    if (normalized.includes("подъем") || normalized.includes("подъём")) return "tone-blue";
    if (normalized.includes("свободный день")) return "tone-skill";
    if (normalized.includes("cs2")) return "tone-stream";
    if (normalized.includes("итоги")) return "tone-evening";
    return "tone-blue";
  }

  function dotClass(taskOrEvent) {
    if (taskOrEvent?.calendarMode === "google") return "google-task";
    if (taskOrEvent?.source === "google-calendar-work") return "google-work";
    if (taskOrEvent?.source === "google-calendar") return "google-task";
    if (taskOrEvent?.source === "task") return "task";
    if (taskOrEvent?.title === "Стрим") return "stream";
    if (taskOrEvent?.title === "Ужин + отчет") return "family";
    return "default";
  }

  function buildWeekendTemplate(weekday) {
    const morningTitle = BASE_EVENTS[0]?.title || "Утро";
    const planningTitle = "Планирование";
    const developmentTitle = "Развитие";
    const workTitle = "Рабочий слот";
    const streamTitle = "Стрим";
    const dinnerTitle = "Ужин + отчет";
    const sleepTitle = "Сон";

    if (weekday === 6) {
      return [
        { title: morningTitle, start: "09:00", end: "10:00", taskable: false },
        { title: planningTitle, start: "10:00", end: "10:30", taskable: false },
        { title: developmentTitle, start: "10:30", end: "11:30", taskable: true },
        { title: workTitle, start: "11:30", end: "12:30", taskable: true },
        { title: workTitle, start: "12:30", end: "13:30", taskable: true },
        { title: workTitle, start: "14:30", end: "15:30", taskable: true },
        { title: streamTitle, start: "18:00", end: "22:00", taskable: false },
        { title: dinnerTitle, start: "22:00", end: "22:30", taskable: false },
        { title: sleepTitle, start: "23:30", end: "07:30", taskable: false },
      ];
    }

    return [
      { title: morningTitle, start: "09:00", end: "10:00", taskable: false },
      { title: planningTitle, start: "10:00", end: "10:30", taskable: false },
      { title: developmentTitle, start: "10:30", end: "11:30", taskable: true },
      { title: workTitle, start: "11:30", end: "12:30", taskable: true },
      { title: workTitle, start: "12:30", end: "13:30", taskable: true },
      { title: streamTitle, start: "18:00", end: "21:00", taskable: false },
      { title: dinnerTitle, start: "21:00", end: "21:30", taskable: false },
      { title: sleepTitle, start: "23:30", end: "07:30", taskable: false },
    ];
  }

  function scheduleTemplateForDate(dateKey) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return BASE_EVENTS;
    }
    const weekday = parsed.getDay();
    if (weekday === 6 || weekday === 0) {
      return buildWeekendTemplate(weekday);
    }
    return BASE_EVENTS;
  }

  function hasMatchingTaskableSlot(dateKey, slotTitle, startTime, endTime) {
    const segmentStart = parseMinutes(startTime);
    let segmentEnd = parseMinutes(endTime);
    if (segmentStart == null || segmentEnd == null) {
      return false;
    }
    if (segmentEnd <= segmentStart) {
      segmentEnd += 1440;
    }

    return scheduleTemplateForDate(dateKey).some((event) => (
      event.taskable
      && event.title === slotTitle
      && (() => {
        const eventStart = parseMinutes(event.start);
        let eventEnd = parseMinutes(event.end);
        if (eventStart == null || eventEnd == null) {
          return false;
        }
        if (eventEnd <= eventStart) {
          eventEnd += 1440;
        }
        return segmentStart >= eventStart && segmentEnd <= eventEnd;
      })()
    ));
  }

  function buildRecurringDateKeysUntilMonthEnd(anchorDate, slotTitle, startTime, endTime) {
    const result = [];
    const endDateKey = monthEndDateKey(anchorDate);
    let cursor = anchorDate;
    let guard = 0;
    while (compareDateKeys(cursor, endDateKey) <= 0 && guard < 62) {
      if (hasMatchingTaskableSlot(cursor, slotTitle, startTime, endTime)) {
        result.push(cursor);
      }
      cursor = shiftDateKey(cursor, 1);
      guard += 1;
    }
    return result;
  }

  function externalEventsForDate(dateKey) {
    const events = Array.isArray(currentContext?.externalEvents)
      ? currentContext.externalEvents
      : [];
    return events
      .filter((event) => String(event?.date || "").trim() === dateKey)
      .filter((event) => /^\d{2}:\d{2}$/.test(String(event?.start || "").trim()))
      .filter((event) => /^\d{2}:\d{2}$/.test(String(event?.end || "").trim()))
      .map((event, index) => mapExternalEventToScheduleBlock(dateKey, event, index));
  }

  function mapExternalEventToScheduleBlock(dateKey, event, index) {
    const actualStart = String(event.start).trim();
    const actualEnd = String(event.end).trim();
    const actualRange = eventRange({ start: actualStart, end: actualEnd });
    const overlappingSlots = scheduleTemplateForDate(dateKey)
      .map((slot) => ({
        ...slot,
        range: eventRange(slot),
      }))
      .filter((slot) => slot.range.start < actualRange.end && slot.range.end > actualRange.start);

    const overlappingTaskableSlots = overlappingSlots.filter((slot) => slot.taskable);
    const calendarId = String(event?.calendarId || "").trim();
    const isWorkCalendar = calendarId === WORK_GOOGLE_CALENDAR_ID;
    const displaySlots = isWorkCalendar && overlappingTaskableSlots.length > 0
      ? overlappingTaskableSlots
      : overlappingSlots;

    const displayStart = displaySlots.length
      ? Math.min(...displaySlots.map((slot) => slot.range.start))
      : Math.floor(actualRange.start / 60) * 60;
    const displayEnd = displaySlots.length
      ? Math.max(...displaySlots.map((slot) => slot.range.end))
      : Math.ceil(actualRange.end / 60) * 60;
    const sourceName = String(event?.source || "").trim() || "Google Calendar";

    return {
      id: `${dateKey}-google-${index}-${actualStart}-${actualEnd}`,
      title: String(event?.title || "").trim() || "Google событие",
      start: formatMinutes(displayStart),
      end: formatMinutes(displayEnd),
      actualStart,
      actualEnd,
      taskable: false,
      embeddedInTaskableSlots: isWorkCalendar && overlappingTaskableSlots.length > 0,
      toneClass: isWorkCalendar ? "tone-google-work" : eventToneClass(event.title),
      kind: "event",
      source: isWorkCalendar ? "google-calendar-work" : "google-calendar",
      sourceLabel: `Факт: ${actualStart}–${actualEnd} · ${sourceName}`,
    };
  }

  function buildBaseEvents(dateKey) {
    const base = scheduleTemplateForDate(dateKey).map((event, index) => ({
      id: `${dateKey}-event-${index}-${event.start}-${event.end}`,
      title: event.title,
      start: event.start,
      end: event.end,
      taskable: event.taskable,
      toneClass: eventToneClass(event.title),
      kind: "event",
      source: "",
    }));
    const external = externalEventsForDate(dateKey);
    return [...base, ...external].sort((left, right) => {
      const leftStart = parseMinutes(left.start) ?? 0;
      const rightStart = parseMinutes(right.start) ?? 0;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      const leftEnd = parseMinutes(left.end) ?? leftStart;
      const rightEnd = parseMinutes(right.end) ?? rightStart;
      if (leftEnd !== rightEnd) {
        return leftEnd - rightEnd;
      }
      return String(left.title || "").localeCompare(String(right.title || ""), "ru");
    });
  }

  function eventRange(event) {
    const start = parseMinutes(event.start) ?? 0;
    let end = parseMinutes(event.end) ?? start;
    if (end <= start) {
      end += 1440;
    }
    return { start, end };
  }

  function classifyRange(range, dateKey) {
    const diff = compareDateKeys(dateKey, todayDateKey());
    // Browse mode should keep the selected date fully visible as a timeline.
    if (diff !== 0) {
      return "future";
    }
    const minutesNow = now().getHours() * 60 + now().getMinutes();
    if (minutesNow >= range.start && minutesNow < range.end) {
      return "current";
    }
    if (minutesNow >= range.end) {
      return "past";
    }
    return "future";
  }

  function mergeTaskableClusters(events) {
    const clusters = [];
    for (const event of events) {
      if (!event.taskable) {
        continue;
      }
      const previous = clusters.at(-1);
      if (previous && previous.title === event.title && previous.end === event.start) {
        previous.end = event.end;
        previous.eventIds.push(event.id);
        continue;
      }
      clusters.push({
        id: `${event.id}-cluster`,
        title: event.title,
        start: event.start,
        end: event.end,
        toneClass: event.toneClass,
        eventIds: [event.id],
      });
    }
    return clusters;
  }

  function splitCluster(cluster) {
    const range = eventRange(cluster);
    const segments = [];
    let cursor = range.start;
    while (cursor < range.end) {
      const next = Math.min(cursor + 60, range.end);
      segments.push({
        id: `${cluster.id}-${formatMinutes(cursor)}-${formatMinutes(next)}`,
        clusterId: cluster.id,
        clusterTitle: cluster.title,
        start: formatMinutes(cursor),
        end: formatMinutes(next),
      });
      cursor = next;
    }
    return segments;
  }

  function timedTasksForDate(dateKey) {
    return loadedTasks
      .filter((task) => String(task?.dueDate || "").trim() === dateKey)
      .filter((task) => taskScope(task) === "day")
      .filter((task) => task.startTime && task.endTime);
  }

  function looseTasksForDate(dateKey) {
    return loadedTasks
      .filter((task) => String(task?.dueDate || "").trim() === dateKey)
      .filter((task) => taskScope(task) === "day")
      .filter((task) => !task.startTime || !task.endTime)
      .slice()
      .sort((left, right) => String(left?.title || "").localeCompare(String(right?.title || ""), "ru"));
  }

  function findTimedTaskForSegment(segment, dateKey) {
    return timedTasksForDate(dateKey).find((task) => task.startTime === segment.start && task.endTime === segment.end) || null;
  }

  function isEmbeddedExternalEvent(event) {
    return Boolean(event?.embeddedInTaskableSlots);
  }

  function segmentOverlapsEvent(segment, event) {
    const segmentRange = eventRange(segment);
    const externalRange = eventRange(event);
    return segmentRange.start < externalRange.end && segmentRange.end > externalRange.start;
  }

  function findEmbeddedExternalEventForSegment(segment, embeddedExternalEvents) {
    return embeddedExternalEvents.find((event) => segmentOverlapsEvent(segment, event)) || null;
  }

  function overrideKey(dateKey, segmentId) {
    return `${dateKey}:${segmentId}`;
  }

  function buildClusterModels(events, dateKey) {
    const clusters = mergeTaskableClusters(events);
    const looseQueue = looseTasksForDate(dateKey);
    const embeddedExternalEvents = events.filter(isEmbeddedExternalEvent);

    return clusters.map((cluster) => {
      const segments = splitCluster(cluster);
      const modelSegments = segments.map((segment) => {
        const state = classifyRange(eventRange(segment), dateKey);
        const realTask = findTimedTaskForSegment(segment, dateKey);
        const embeddedExternalEvent = findEmbeddedExternalEventForSegment(segment, embeddedExternalEvents);
        const override = slotOverrides.get(overrideKey(dateKey, segment.id)) || null;
        let visualTask = null;

        if (embeddedExternalEvent) {
          visualTask = {
            kind: "external",
            id: embeddedExternalEvent.id,
            title: embeddedExternalEvent.title || "Google событие",
            status: "todo",
            meta: embeddedExternalEvent.sourceLabel || "Google Calendar",
            toneClass: embeddedExternalEvent.toneClass,
            source: embeddedExternalEvent.source,
          };
        } else if (realTask) {
          visualTask = {
            kind: "real",
            id: realTask.id,
            title: realTask.title || "Без названия",
            status: realTask.status === "done" ? "done" : "todo",
            meta: realTask.calendarMode === "google" ? "Глобальная задача" : "Локальная задача",
          };
        } else if (override) {
          visualTask = {
            kind: "stub",
            title: override.title || "Новая задача",
            status: "todo",
            meta: "Локальная задача",
          };
        } else if (state !== "past" && looseQueue.length > 0) {
          const draft = looseQueue.shift();
          visualTask = {
            kind: "stub",
            title: draft.title || "Новая задача",
            status: "todo",
            meta: "Локальная задача",
          };
        }

        if (visualTask?.kind === "stub") {
          visualTask.title = String(visualTask.title || "").trim() || "Новая задача";
          visualTask.meta = "";
        }

        const isPrimaryFree = !visualTask && state !== "past";

        return {
          ...segment,
          state,
          visualTask,
          isPrimaryFree,
          isQuietFree: !visualTask && state === "past",
        };
      });

      return {
        ...cluster,
        state: classifyRange(eventRange(cluster), dateKey),
        segments: modelSegments,
      };
    });
  }

  function activeClusterModel(clusterModels) {
    return clusterModels.find((cluster) => cluster.state === "current") || null;
  }

  function buildPastDisplayItems(events, clusterModels, dateKey) {
    const items = [];

    events.forEach((event) => {
      if (classifyRange(eventRange(event), dateKey) !== "past") {
        return;
      }
      if (event.taskable || isEmbeddedExternalEvent(event)) {
        return;
      }
      items.push({
        id: `event:${event.id}`,
        title: event.title,
        start: event.start,
        end: event.end,
        toneClass: event.toneClass,
      });
    });

    clusterModels.forEach((cluster) => {
      cluster.segments.forEach((segment) => {
        if (segment.state !== "past") {
          return;
        }
        const hasTask = Boolean(segment.visualTask);
        items.push({
          id: `segment:${segment.id}`,
          title: hasTask ? segment.visualTask.title : cluster.title,
          start: segment.start,
          end: segment.end,
          toneClass: cluster.toneClass,
          source: hasTask ? "task" : "slot",
          rowClass: hasTask ? "task-past" : "slot-past",
          sourceLabel: hasTask ? (segment.visualTask.meta || cluster.title) : "Слот завершён",
        });
      });
    });

    return items.sort((left, right) => {
      const leftStart = parseMinutes(left.start) ?? 0;
      const rightStart = parseMinutes(right.start) ?? 0;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      const leftEnd = parseMinutes(left.end) ?? leftStart;
      const rightEnd = parseMinutes(right.end) ?? rightStart;
      return leftEnd - rightEnd;
    });
  }

  function nextDisplayCandidate(events, clusterModels, currentCluster, dateKey) {
    const candidates = [];

    events.forEach((event) => {
      if (classifyRange(eventRange(event), dateKey) !== "future") {
        return;
      }
      if (event.taskable || isEmbeddedExternalEvent(event)) {
        return;
      }
      candidates.push({
        kind: "event",
        title: event.title,
        start: event.start,
        end: event.end,
        toneClass: event.toneClass,
      });
    });

    clusterModels
      .filter((cluster) => cluster.id !== currentCluster?.id)
      .forEach((cluster) => {
        const nextSegment = cluster.segments.find((segment) => segment.state === "future");
        if (!nextSegment) {
          return;
        }
        candidates.push({
          kind: nextSegment.visualTask ? "task" : "event",
          title: nextSegment.visualTask?.title || cluster.title,
          start: nextSegment.start,
          end: nextSegment.end,
          toneClass: cluster.toneClass,
        });
      });

    return candidates.sort((left, right) => {
      const leftStart = parseMinutes(left.start) ?? 0;
      const rightStart = parseMinutes(right.start) ?? 0;
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      const leftEnd = parseMinutes(left.end) ?? leftStart;
      const rightEnd = parseMinutes(right.end) ?? rightStart;
      return leftEnd - rightEnd;
    })[0] || null;
  }

  function renderEventRow(event, variant = "future") {
    return `
      <div class="event-row ${variant} ${event.rowClass ? escapeHtml(event.rowClass) : ""} ${event.toneClass ? `toned ${event.toneClass}` : ""}">
        <div class="dot ${dotClass(event)}"></div>
        <div class="event-time">${escapeHtml(`${event.start}–${event.end}`)}</div>
        <div class="event-info">
          <div class="event-title">${escapeHtml(event.title)}</div>
          ${event.sourceLabel ? `<div class="event-source">${escapeHtml(event.sourceLabel)}</div>` : ""}
        </div>
      </div>
    `;
  }

  function renderWeeklyTasksBlock() {
    const rows = Array.from({ length: NOTE_SLOTS.length }, (_item, index) => {
      const slot = NOTE_SLOTS[index];
      const task = weeklyTaskForSlot(index);
      const isEditing = weeklyComposerState?.slotIndex === index;
      const isFixed = Boolean(slot.fixed);
      const isDone = task?.status === "done";

      if (isFixed) {
        return `
          <div class="weekly-task-row note-fixed ${isDone ? "done" : "todo"}">
            <button
              class="note-check"
              type="button"
              data-note-toggle="${index}"
              data-note-status="${isDone ? "todo" : "done"}"
              aria-label="${isDone ? "\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u043a\u0430\u043a \u043d\u0435 \u0441\u0434\u0435\u043b\u0430\u043d\u043e" : "\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u043a\u0430\u043a \u0441\u0434\u0435\u043b\u0430\u043d\u043e"}"
              title="${isDone ? "\u0421\u0434\u0435\u043b\u0430\u043d\u043e" : "\u041d\u0435 \u0441\u0434\u0435\u043b\u0430\u043d\u043e"}"
            >${isDone ? "\u2713" : ""}</button>
            <div class="weekly-task-info">
              <div class="weekly-task-title">${escapeHtml(slot.title)}</div>
              <div class="weekly-task-source">${isDone ? "\u0441\u0434\u0435\u043b\u0430\u043d\u043e" : "\u043d\u0435 \u0441\u0434\u0435\u043b\u0430\u043d\u043e"}</div>
            </div>
          </div>
        `;
      }

      if (isEditing) {
        return `
          <div class="weekly-task-row editing">
            <div class="dot weekly"></div>
            <div class="weekly-task-info">
              <input
                class="weekly-task-input"
                data-weekly-title
                type="text"
                value="${escapeHtml(weeklyComposerState.title || "")}"
                placeholder="\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430"
              >
              <div class="weekly-task-actions">
                <button type="button" data-weekly-save="${index}">\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</button>
                <button type="button" data-weekly-cancel>\u041e\u0442\u043c\u0435\u043d\u0430</button>
                ${task ? `<button type="button" class="danger" data-weekly-delete="${index}">\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c</button>` : ""}
              </div>
            </div>
          </div>
        `;
      }

      const title = task?.title || slot.title;
      const source = task
        ? "\u0441\u0432\u043e\u0431\u043e\u0434\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430"
        : slot.source;

      return `
      <button class="weekly-task-row ${task ? "filled" : "empty"}" type="button" data-weekly-slot="${index}">
        <div class="dot weekly"></div>
        <div class="weekly-task-info">
          <div class="weekly-task-title">${escapeHtml(title)}</div>
          <div class="weekly-task-source">${escapeHtml(source)}</div>
        </div>
        <div class="weekly-task-action">${task ? "\u203a" : "+"}</div>
      </button>
    `;
    }).join("");

    return `
      <div class="section-label weekly-section-label">\u0417\u0430\u043c\u0435\u0442\u043a\u0438</div>
      <div class="weekly-task-list">${rows}</div>
    `;
  }

  function renderComposer(segment, dateKey) {
    if (!composerState || composerState.segmentId !== segment.id) {
      return "";
    }
    const isEdit = Boolean(composerState.taskId);
    return `
      <div class="slot-quick-add" data-composer-root="${segment.id}">
        <div class="slot-quick-head">
          <div class="slot-quick-title">${isEdit ? "Редактирование задачи" : "Задача в слоте"}</div>
          <div class="slot-quick-range">${escapeHtml(`${segment.start}–${segment.end}`)}</div>
        </div>
        <div class="slot-quick-target">${escapeHtml(formatUiDate(dateKey))}</div>
        <input
          class="slot-quick-input"
          data-composer-title
          type="text"
          value="${escapeHtml(composerState.title || "")}"
          placeholder="Название задачи"
        >
        ${
          !isEdit
            ? `<label class="slot-quick-repeat">
                <input
                  type="checkbox"
                  data-composer-repeat
                  ${composerState.repeatToMonth ? "checked" : ""}
                >
                <span>Повторять до конца месяца</span>
              </label>`
            : ""
        }
        <div class="slot-quick-note">Локальная задача для этого слота.</div>
        <div class="slot-quick-actions">
          <button class="primary-action" type="button" data-composer-save="${segment.id}">Сохранить</button>
          <button class="secondary-action" type="button" data-composer-cancel>Отмена</button>
          <button class="small-danger" type="button" data-composer-delete="${segment.id}">Очистить слот</button>
        </div>
      </div>
    `;
  }

  function renderSlotCluster(cluster, options) {
    const trimPastSegments = Boolean(options?.trimPastSegments);
    const visibleSegments = trimPastSegments
      ? cluster.segments.filter((segment) => segment.state !== "past")
      : cluster.segments;

    return `
      <div class="slot-cluster ${cluster.toneClass ? `toned ${cluster.toneClass}` : ""}">
        <div class="slot-cluster-header">
          <div class="slot-cluster-title">${escapeHtml(cluster.title)}</div>
          <div class="slot-cluster-meta">${escapeHtml(`${cluster.start}–${cluster.end}`)}</div>
        </div>
        <div class="slot-strip-list">
          ${visibleSegments.map((segment) => {
            const isDoneTask = segment.visualTask?.kind === "real" && segment.visualTask?.status === "done";
            const isExternalTask = segment.visualTask?.kind === "external";
            const label = segment.visualTask
              ? segment.visualTask.title
              : (segment.isPrimaryFree ? "Добавить задачу" : "");
            const stateLabel = segment.visualTask
              ? (isDoneTask ? "Выполнено" : segment.visualTask.meta)
              : "";
            const action = segment.isPrimaryFree ? "+" : "";
            const classes = [
              "slot-strip",
              segment.visualTask ? "occupied" : "empty",
              segment.visualTask?.kind === "real" ? "task-slot" : "",
              segment.visualTask?.kind === "stub" ? "stub-slot" : "",
              isExternalTask ? "external-slot" : "",
              isDoneTask ? "task-done" : "",
              segment.isPrimaryFree ? "free-cta" : "",
              segment.isQuietFree ? "quiet-free" : "",
              segment.state === "current" ? "current-segment" : "",
            ].filter(Boolean).join(" ");
            const segmentKind = isExternalTask ? "quiet" : (segment.visualTask?.kind || (segment.isPrimaryFree ? "free" : "quiet"));

            return `
              <div class="slot-segment">
                <button
                  class="${classes}"
                  type="button"
                  data-segment-id="${segment.id}"
                  data-segment-kind="${segmentKind}"
                >
                  <span class="slot-strip-time">${escapeHtml(`${segment.start}–${segment.end}`)}</span>
                  <span class="slot-strip-body">
                    <span class="slot-strip-label">${label ? escapeHtml(label) : "&nbsp;"}</span>
                    <span class="slot-strip-state">${stateLabel ? escapeHtml(stateLabel) : ""}</span>
                  </span>
                  ${
                    segment.visualTask?.kind === "real"
                      ? `<span
                          class="slot-task-toggle ${isDoneTask ? "is-done" : ""}"
                          data-task-toggle="true"
                          data-task-id="${escapeHtml(segment.visualTask.id || "")}"
                          data-next-status="${isDoneTask ? "todo" : "done"}"
                          role="button"
                          tabindex="0"
                          aria-label="${isDoneTask ? "Вернуть задачу в работу" : "Отметить задачу выполненной"}"
                        >${isDoneTask ? "↺" : "✓"}</span>`
                      : ""
                  }
                  ${action ? `<span class="slot-strip-action">${escapeHtml(action)}</span>` : ""}
                </button>
                ${renderComposer(segment, selectedDateKey)}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function buildFocusBlock(events, clusterModels, dateKey) {
    const currentEvent = events.find((event) => classifyRange(eventRange(event), dateKey) === "current") || null;
    const currentCluster = activeClusterModel(clusterModels);
    const nextDisplay = nextDisplayCandidate(events, clusterModels, currentCluster, dateKey);

    focusTimerState = null;

    if (isToday(dateKey) && currentEvent) {
      const range = eventRange(currentEvent);
      const activeSegment = currentCluster?.segments.find((segment) => segment.state === "current") || null;
      const currentDisplay = activeSegment?.visualTask
        && activeSegment.visualTask.status !== "done"
        ? {
            kind: activeSegment.visualTask.kind === "external" ? "event" : "task",
            title: activeSegment.visualTask.title,
            start: activeSegment.start,
            end: activeSegment.end,
            toneClass: currentCluster?.toneClass || currentEvent.toneClass,
            sourceLabel: activeSegment.visualTask.meta,
          }
        : {
            kind: "event",
            title: currentEvent.title,
            start: currentEvent.start,
            end: currentEvent.end,
            toneClass: currentEvent.toneClass,
            sourceLabel: currentEvent.sourceLabel,
          };

      const remainingMinutes = Math.max(range.end - (now().getHours() * 60 + now().getMinutes()), 0);
      focusTimerState = {
        targetAtMs: timeToEpochMs(dateKey, currentDisplay.end),
      };

      return `
        <div class="current-block ${currentDisplay.toneClass ? `toned ${currentDisplay.toneClass}` : ""}">
          <div class="label">${currentDisplay.kind === "task" ? "Задача сейчас" : "Сейчас"}</div>
          <div class="title">${escapeHtml(currentDisplay.title)}</div>
          ${currentDisplay.sourceLabel ? `<div class="focus-source">${escapeHtml(currentDisplay.sourceLabel)}</div>` : ""}
          <div class="meta">
            <span>${escapeHtml(`${currentDisplay.start} – ${currentDisplay.end}`)}</span>
            <span class="countdown">${remainingMinutes} мин</span>
          </div>
          <div class="countdown-timer">
            <div class="digits" id="timerDigits">${formatTimerMarkup((focusTimerState.targetAtMs - Date.now()) / 1000)}</div>
            <div class="until-label">${currentDisplay.kind === "task" ? "до конца задачи" : "до конца блока"}</div>
          </div>
        </div>
      `;
    }

    if (isToday(dateKey) && nextDisplay) {
      const next = nextDisplay;
      const nextAtMs = timeToEpochMs(dateKey, next.start);
      const minutesUntil = Math.max(parseMinutes(next.start) - (now().getHours() * 60 + now().getMinutes()), 0);
      focusTimerState = { targetAtMs: nextAtMs };
      const breakTitle = next.title;

      return `
        <div class="break-block ${next.toneClass ? `toned ${next.toneClass}` : ""}">
          <div class="label">Перерыв</div>
          <div class="title">${escapeHtml(next.title)}</div>
          ${next.sourceLabel ? `<div class="focus-source">${escapeHtml(next.sourceLabel)}</div>` : ""}
          <div class="meta">
            <span>через ${minutesUntil} мин · ${escapeHtml(next.start)}</span>
          </div>
          <div class="countdown-timer">
            <div class="digits" id="timerDigits">${formatTimerMarkup((nextAtMs - Date.now()) / 1000)}</div>
            <div class="until-label">до начала</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="task-panel">
        <div class="label">${isBrowseMode(dateKey) ? "День" : "Сейчас"}</div>
        <div class="title">${escapeHtml(isBrowseMode(dateKey) ? formatUiDate(dateKey) : "На сегодня всё")}</div>
        <div class="meta">${escapeHtml(
          isBrowseMode(dateKey)
            ? "План выбранной даты"
            : "Активных блоков не осталось"
        )}</div>
      </div>
    `;
  }

  function renderDay() {
    const dateKey = selectedDateKey;
    const events = buildBaseEvents(dateKey);
    const clusterModels = buildClusterModels(events, dateKey);
    segmentModelsById = new Map();
    clusterModels.forEach((cluster) => {
      cluster.segments.forEach((segment) => {
        segmentModelsById.set(segment.id, {
          ...segment,
          clusterTitle: cluster.title,
          clusterToneClass: cluster.toneClass,
        });
      });
    });
    const currentCluster = activeClusterModel(clusterModels);
    const pastItems = !isBrowseMode(dateKey)
      ? buildPastDisplayItems(events, clusterModels, dateKey)
      : [];

    const futureEvents = events.filter((event) => {
      const state = classifyRange(eventRange(event), dateKey);
      if (state !== "future") {
        return false;
      }
        if (isEmbeddedExternalEvent(event)) {
          return false;
        }
        if (!currentCluster || !event.taskable) {
          return true;
        }
      return !currentCluster.eventIds.includes(event.id);
    });

    let html = "";

    if (pastItems.length > 0) {
      html += `<div class="section-label">Прошло (${pastItems.length})</div>`;
      pastItems.forEach((event) => {
        html += renderEventRow(event, "past");
      });
    }

    html += buildFocusBlock(events, clusterModels, dateKey);

    if (currentCluster) {
      html += `<div class="section-label">Текущий слот</div>`;
      html += renderSlotCluster(currentCluster, { trimPastSegments: true });
    }

    const futureClusterIds = new Set(clusterModels.filter((cluster) => cluster.state === "future").map((cluster) => cluster.id));

    if (futureEvents.length > 0 || futureClusterIds.size > 0) {
      html += `<div class="section-label">${isBrowseMode(dateKey) ? "День" : "Далее"}</div>`;

      const renderedClusters = new Set();
      futureEvents.forEach((event) => {
        if (isEmbeddedExternalEvent(event)) {
          return;
        }
        if (!event.taskable) {
          html += renderEventRow(event, "future");
          return;
        }

        const cluster = clusterModels.find((item) => item.eventIds.includes(event.id));
        if (!cluster || renderedClusters.has(cluster.id) || cluster.id === currentCluster?.id) {
          return;
        }
        html += renderSlotCluster(cluster, { trimPastSegments: false });
        renderedClusters.add(cluster.id);
      });

      clusterModels
        .filter((cluster) => cluster.state === "future")
        .filter((cluster) => cluster.id !== currentCluster?.id)
        .forEach((cluster) => {
          if (renderedClusters.has(cluster.id)) {
            return;
          }
          html += renderSlotCluster(cluster, { trimPastSegments: false });
          renderedClusters.add(cluster.id);
        });
    }

    html += renderWeeklyTasksBlock();

    dom.content.innerHTML = html;

    const total = events.length;
    const done = pastItems.length;
    const scheduledTasks = loadedTasks.filter((task) => String(task?.dueDate || "").trim() === dateKey).length;
    dom.stats.textContent = `${done}/${total} блоков • задач: ${scheduledTasks} • ${isBrowseMode(dateKey) ? "просмотр дня" : "сегодня"}`;
    if (isBrowseMode(dateKey)) {
      dom.stats.textContent = `блоков: ${total} • задач: ${scheduledTasks} • просмотр дня`;
    } else {
      dom.stats.textContent = `${done}/${total} блоков • задач: ${scheduledTasks} • сегодня`;
    }
    updateFocusTimer();
  }

  function setDateUI(dateKey) {
    selectedDateKey = dateKey;
    dom.dateInput.value = dateKey;
    dom.dateLabel.textContent = formatUiDate(dateKey);
    if (!calendarState.isOpen) {
      syncCalendarViewToSelected();
    } else {
      renderCalendarPopover();
    }
  }

  async function loadDate(dateKey) {
    closeCalendarPopover();
    if (!api) {
      setStatus("СБОЙ МОСТА", "error");
      return;
    }

    setStatus("ЧТЕНИЕ...", "busy");
    try {
      const weekStart = weekStartDateKey(dateKey);
      const [context, listResponse, weekListResponse] = await Promise.all([
        api.getDayContext(dateKey),
        api.listTasks(dateKey),
        weekStart === dateKey ? Promise.resolve(null) : api.listTasks(weekStart),
      ]);
      const tasks = parseTaskListResponse(listResponse);
      const weekTasks = weekStart === dateKey ? tasks : parseTaskListResponse(weekListResponse);
      currentContext = context || null;
      loadedTasks = tasks.filter((task) => taskScope(task) === "day");
      loadedWeeklyTasks = sortWeeklyTasks(weekTasks);
      composerState = null;
      weeklyComposerState = null;
      setDateUI(context?.dateKey || dateKey);
      renderDay();
      lastLiveMinuteKey = currentMinuteKey();
      setStatus("ГОТОВО", "success");
    } catch (error) {
      loadedTasks = [];
      loadedWeeklyTasks = [];
      currentContext = null;
      setDateUI(dateKey);
      renderDay();
      setStatus(`СБОЙ ЧТЕНИЯ: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
    }
  }

  function openComposer(segmentId) {
    const segmentModel = segmentModelsById.get(segmentId);
    if (!segmentModel) {
      return;
    }
    composerState = {
      segmentId,
      taskId: segmentModel.visualTask?.kind === "real" ? segmentModel.visualTask.id : null,
      dateKey: selectedDateKey,
      startTime: segmentModel.start,
      endTime: segmentModel.end,
      slotTitle: segmentModel.clusterTitle || "",
      title: segmentModel.visualTask?.title || "",
      initialTitle: segmentModel.visualTask?.title || "",
      repeatToMonth: false,
      initialRepeatToMonth: false,
    };
    weeklyComposerState = null;
    renderDay();
    requestAnimationFrame(() => {
      const input = dom.content.querySelector("[data-composer-title]");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function openWeeklyComposer(slotIndex) {
    const task = weeklyTaskForSlot(slotIndex);
    weeklyComposerState = {
      slotIndex,
      taskId: task?.id || null,
      title: task?.title || "",
      initialTitle: task?.title || "",
    };
    composerState = null;
    renderDay();
    requestAnimationFrame(() => {
      const input = dom.content.querySelector("[data-weekly-title]");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  async function setFixedNoteStatus(slotIndex, nextStatus) {
    const slot = NOTE_SLOTS[slotIndex];
    if (!slot?.fixed || (nextStatus !== "todo" && nextStatus !== "done")) {
      return;
    }

    const task = weeklyTaskForSlot(slotIndex);
    const dateKey = weekStartDateKey(selectedDateKey);
    const slotRange = weeklySlotRange(slotIndex);

    try {
      setStatus(nextStatus === "done" ? "\u041e\u0422\u041c\u0415\u0422\u041a\u0410..." : "\u0421\u041d\u042f\u0422\u0418\u0415 \u041e\u0422\u041c\u0415\u0422\u041a\u0418...", "busy");
      if (!api) {
        const nextTask = {
          id: task?.id || `note-${dateKey}-${slotIndex}`,
          title: slot.title,
          dueDate: dateKey,
          date: dateKey,
          scope: "week",
          status: nextStatus,
          startTime: slotRange.startTime,
          endTime: slotRange.endTime,
          createdAt: task?.createdAt || new Date().toISOString(),
        };
        loadedWeeklyTasks = [
          ...loadedWeeklyTasks.filter((item) => item?.id !== nextTask.id),
          nextTask,
        ];
        loadedWeeklyTasks = sortWeeklyTasks(loadedWeeklyTasks);
        renderDay();
        setStatus(nextStatus === "done" ? "\u0421\u0414\u0415\u041b\u0410\u041d\u041e" : "\u041d\u0415 \u0421\u0414\u0415\u041b\u0410\u041d\u041e", "success");
        return;
      }

      let taskId = task?.id || "";
      if (taskId && task.title !== slot.title) {
        await api.updateTask({
          id: taskId,
          title: slot.title,
          dateKey,
          scope: "week",
          startTime: slotRange.startTime,
          endTime: slotRange.endTime,
        });
      }
      if (!taskId) {
        const created = await api.createTask({
          title: slot.title,
          dateKey,
          scope: "week",
          startTime: slotRange.startTime,
          endTime: slotRange.endTime,
        });
        taskId = created?.id || "";
      }
      if (taskId) {
        await api.setTaskStatus({ id: taskId, status: nextStatus });
      }
      await loadDate(selectedDateKey);
      setStatus(nextStatus === "done" ? "\u0421\u0414\u0415\u041b\u0410\u041d\u041e" : "\u041d\u0415 \u0421\u0414\u0415\u041b\u0410\u041d\u041e", "success");
    } catch (error) {
      setStatus(`\u0421\u0411\u041e\u0419 \u0417\u0410\u041c\u0415\u0422\u041a\u0418: ${error instanceof Error ? error.message : "\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430"}`, "error");
    }
  }

  async function saveWeeklyTask() {
    if (!weeklyComposerState) {
      return;
    }
    const input = dom.content.querySelector("[data-weekly-title]");
    const title = String(input?.value || "").trim() || "\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430";
    const dateKey = weekStartDateKey(selectedDateKey);
    const slotRange = weeklySlotRange(weeklyComposerState.slotIndex);

    try {
      setStatus("\u0421\u041e\u0425\u0420\u0410\u041d\u0415\u041d\u0418\u0415...", "busy");
      if (!api) {
        const fallbackId = weeklyComposerState.taskId || `weekly-${dateKey}-${weeklyComposerState.slotIndex}`;
        loadedWeeklyTasks[weeklyComposerState.slotIndex] = {
          id: fallbackId,
          title,
          dueDate: dateKey,
          date: dateKey,
          scope: "week",
          startTime: slotRange.startTime,
          endTime: slotRange.endTime,
          createdAt: new Date().toISOString(),
        };
        weeklyComposerState = null;
        renderDay();
        setStatus("\u0417\u0410\u041c\u0415\u0422\u041a\u0410 \u041e\u0411\u041d\u041e\u0412\u041b\u0415\u041d\u0410", "success");
        return;
      }

      if (weeklyComposerState.taskId) {
        await api.updateTask({
          id: weeklyComposerState.taskId,
          title,
          dateKey,
          scope: "week",
          startTime: slotRange.startTime,
          endTime: slotRange.endTime,
        });
      } else {
        await api.createTask({
          title,
          dateKey,
          scope: "week",
          startTime: slotRange.startTime,
          endTime: slotRange.endTime,
        });
      }
      weeklyComposerState = null;
      await loadDate(selectedDateKey);
      setStatus("\u0417\u0410\u041c\u0415\u0422\u041a\u0410 \u041e\u0411\u041d\u041e\u0412\u041b\u0415\u041d\u0410", "success");
    } catch (error) {
      setStatus(`\u0421\u0411\u041e\u0419 \u0417\u0410\u041c\u0415\u0422\u041a\u0418: ${error instanceof Error ? error.message : "\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430"}`, "error");
    }
  }

  async function handleContentClick(event) {
    const noteToggleButton = event.target.closest("[data-note-toggle]");
    if (noteToggleButton) {
      const slotIndex = Number(noteToggleButton.getAttribute("data-note-toggle"));
      const nextStatus = noteToggleButton.getAttribute("data-note-status") || "done";
      if (Number.isInteger(slotIndex)) {
        await setFixedNoteStatus(slotIndex, nextStatus);
      }
      return;
    }

    const weeklySaveButton = event.target.closest("[data-weekly-save]");
    if (weeklySaveButton) {
      await saveWeeklyTask();
      return;
    }

    if (event.target.closest("[data-weekly-cancel]")) {
      weeklyComposerState = null;
      renderDay();
      setStatus("\u041e\u0422\u041c\u0415\u041d\u0410", "neutral");
      return;
    }

    const weeklyDeleteButton = event.target.closest("[data-weekly-delete]");
    if (weeklyDeleteButton && weeklyComposerState) {
      const taskId = weeklyComposerState.taskId;
      if (!taskId) {
        weeklyComposerState = null;
        renderDay();
        setStatus("\u0417\u0410\u041c\u0415\u0422\u041a\u0410 \u041e\u0427\u0418\u0429\u0415\u041d\u0410", "success");
        return;
      }

      try {
        setStatus("\u041e\u0427\u0418\u0421\u0422\u041a\u0410...", "busy");
        await api.deleteTask({ id: taskId });
        weeklyComposerState = null;
        await loadDate(selectedDateKey);
        setStatus("\u0417\u0410\u041c\u0415\u0422\u041a\u0410 \u041e\u0427\u0418\u0429\u0415\u041d\u0410", "success");
      } catch (error) {
        setStatus(`\u0421\u0411\u041e\u0419 \u041e\u0427\u0418\u0421\u0422\u041a\u0418: ${error instanceof Error ? error.message : "\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430"}`, "error");
      }
      return;
    }

    const weeklySlotButton = event.target.closest("[data-weekly-slot]");
    if (weeklySlotButton) {
      const slotIndex = Number(weeklySlotButton.getAttribute("data-weekly-slot"));
      if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < NOTE_SLOTS.length && !NOTE_SLOTS[slotIndex]?.fixed) {
        openWeeklyComposer(slotIndex);
      }
      return;
    }

    const toggleButton = event.target.closest("[data-task-toggle]");
    if (toggleButton) {
      const taskId = toggleButton.getAttribute("data-task-id") || "";
      const nextStatus = toggleButton.getAttribute("data-next-status") || "todo";
      if (!taskId || (nextStatus !== "todo" && nextStatus !== "done")) {
        return;
      }
      if (!api) {
        loadedTasks = loadedTasks.map((task) => {
          if (task?.id !== taskId) {
            return task;
          }
          return { ...task, status: nextStatus };
        });
        renderDay();
        setStatus(nextStatus === "done" ? "ЗАДАЧА ВЫПОЛНЕНА" : "ЗАДАЧА В РАБОТЕ", "success");
        return;
      }

      try {
        setStatus(nextStatus === "done" ? "ЗАКРЫТИЕ..." : "ВОЗВРАТ В РАБОТУ...", "busy");
        await api.setTaskStatus({ id: taskId, status: nextStatus });
        await loadDate(selectedDateKey);
        setStatus(nextStatus === "done" ? "ЗАДАЧА ВЫПОЛНЕНА" : "ЗАДАЧА В РАБОТЕ", "success");
      } catch (error) {
        setStatus(`СБОЙ СТАТУСА: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
      }
      return;
    }

    const saveButton = event.target.closest("[data-composer-save]");
    if (saveButton && composerState) {
      const input = dom.content.querySelector("[data-composer-title]");
      const title = String(input?.value || "").trim() || "Новая задача";

      if (!api) {
        slotOverrides.set(overrideKey(selectedDateKey, composerState.segmentId), {
          title: String(title || "").trim() || "Новая задача",
        });
        composerState = null;
        renderDay();
        setStatus("ЗАПИСЬ ОБНОВЛЕНА", "success");
        return;
      }

      try {
        setStatus("СОХРАНЕНИЕ...", "busy");
        if (composerState.taskId) {
          await api.updateTask({
            id: composerState.taskId,
            title,
            dateKey: composerState.dateKey,
            startTime: composerState.startTime,
            endTime: composerState.endTime,
          });
        } else {
          if (composerState.repeatToMonth) {
            const repeatDateKeys = buildRecurringDateKeysUntilMonthEnd(
              composerState.dateKey,
              composerState.slotTitle,
              composerState.startTime,
              composerState.endTime
            );
            const seriesResult = await api.createRecurringTaskSeries({
              title,
              anchorDate: composerState.dateKey,
              startTime: composerState.startTime,
              endTime: composerState.endTime,
              dateKeys: repeatDateKeys,
            });
            const createdCount = Number(seriesResult?.createdCount || 0);
            const skippedCount = Number(seriesResult?.skippedCount || 0);
            slotOverrides.delete(overrideKey(selectedDateKey, composerState.segmentId));
            composerState = null;
            await loadDate(selectedDateKey);
            setStatus(`СЕРИЯ: +${createdCount}, ПРОПУСК ${skippedCount}`, "success");
            return;
          }

          await api.createTask({
            title,
            dateKey: composerState.dateKey,
            startTime: composerState.startTime,
            endTime: composerState.endTime,
          });
        }
        slotOverrides.delete(overrideKey(selectedDateKey, composerState.segmentId));
        composerState = null;
        await loadDate(selectedDateKey);
        setStatus("ЗАПИСЬ ОБНОВЛЕНА", "success");
      } catch (error) {
        setStatus(`СБОЙ СОХРАНЕНИЯ: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
      }
      return;
    }

    const deleteButton = event.target.closest("[data-composer-delete]");
    if (deleteButton && composerState) {
      if (!api || !composerState.taskId) {
        slotOverrides.delete(overrideKey(selectedDateKey, composerState.segmentId));
        composerState = null;
        renderDay();
        setStatus("ЗАПИСЬ ОЧИЩЕНА", "success");
        return;
      }

      try {
        setStatus("ОЧИСТКА...", "busy");
        await api.deleteTask({ id: composerState.taskId });
        slotOverrides.delete(overrideKey(selectedDateKey, composerState.segmentId));
        composerState = null;
        await loadDate(selectedDateKey);
        setStatus("ЗАПИСЬ ОЧИЩЕНА", "success");
      } catch (error) {
        setStatus(`СБОЙ ОЧИСТКИ: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
      }
      return;
    }

    if (event.target.closest("[data-composer-cancel]")) {
      composerState = null;
      renderDay();
      setStatus("ОТМЕНА", "neutral");
      return;
    }

    const segmentButton = event.target.closest("[data-segment-id]");
    if (segmentButton) {
      if ((segmentButton.dataset.segmentKind || "") === "quiet") {
        return;
      }
      const segmentId = segmentButton.dataset.segmentId || "";
      if (
        composerState &&
        composerState.segmentId === segmentId &&
        String(composerState.title || "").trim() === String(composerState.initialTitle || "").trim() &&
        Boolean(composerState.repeatToMonth) === Boolean(composerState.initialRepeatToMonth)
      ) {
        composerState = null;
        renderDay();
        setStatus("ОТМЕНА", "neutral");
        return;
      }
      openComposer(segmentId);
    }
  }

  function handleContentInput(event) {
    const weeklyTitleInput = event.target.closest("[data-weekly-title]");
    if (weeklyTitleInput && weeklyComposerState) {
      weeklyComposerState.title = weeklyTitleInput.value;
      return;
    }

    const titleInput = event.target.closest("[data-composer-title]");
    if (titleInput && composerState) {
      composerState.title = titleInput.value;
    }
  }

  function handleContentChange(event) {
    const repeatInput = event.target.closest("[data-composer-repeat]");
    if (!repeatInput || !composerState) {
      return;
    }
    composerState.repeatToMonth = Boolean(repeatInput.checked);
  }

  function handleContentKeydown(event) {
    const weeklyTitleInput = event.target.closest("[data-weekly-title]");
    if (weeklyTitleInput && weeklyComposerState && event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      const saveButton = dom.content.querySelector(`[data-weekly-save="${weeklyComposerState.slotIndex}"]`);
      saveButton?.click();
      return;
    }

    const titleInput = event.target.closest("[data-composer-title]");
    if (titleInput && composerState && event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      const saveButton = dom.content.querySelector(`[data-composer-save="${composerState.segmentId}"]`);
      saveButton?.click();
      return;
    }

    const toggle = event.target.closest("[data-task-toggle]");
    if (!toggle) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle.click();
    }
  }

  function handleDateShift(offset) {
    loadDate(shiftDateKey(selectedDateKey, offset));
  }

  function openDatePicker() {
    if (!dom.datePopover) {
      dom.dateInput.showPicker?.();
      dom.dateInput.click();
      return;
    }
    calendarState.isOpen = !calendarState.isOpen;
    syncCalendarViewToSelected();
    renderCalendarPopover();
  }

  function handleCalendarClick(event) {
    const dateButton = event.target.closest("[data-calendar-date]");
    if (dateButton) {
      const dateKey = dateButton.getAttribute("data-calendar-date");
      if (dateKey) {
        closeCalendarPopover();
        loadDate(dateKey);
      }
      return;
    }

    const navButton = event.target.closest("[data-calendar-nav]");
    if (navButton) {
      const delta = Number(navButton.getAttribute("data-calendar-nav")) || 0;
      const moved = new Date(calendarState.viewYear, calendarState.viewMonth + delta, 1);
      calendarState.viewYear = moved.getFullYear();
      calendarState.viewMonth = moved.getMonth();
      renderCalendarPopover();
    }
  }

  function handleDocumentClick(event) {
    if (!calendarState.isOpen || !dom.dateNav) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && dom.dateNav.contains(target)) {
      return;
    }
    closeCalendarPopover();
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
      closeCalendarPopover();
    }
  }

  async function runSyncSelectedDay() {
    if (!api?.syncGoogleDay) {
      setStatus("СИНК НЕДОСТУПЕН", "error");
      return;
    }

    setStatus(`СИНК ${formatUiDate(selectedDateKey)}...`, "busy");
    try {
      const result = await api.syncGoogleDay({ dateKey: selectedDateKey });
      await loadDate(selectedDateKey);
      const importedCount = Number(result?.importedCount || 0);
      if (result?.ok) {
        setStatus(`СИНК ОК: ${importedCount} СОБЫТИЙ`, "success");
        return;
      }
      const reason = String(result?.notes || result?.reason || "sync_failed").replaceAll("_", " ");
      setStatus(`СИНК СБОЙ: ${reason}`, "error");
    } catch (error) {
      setStatus(`СИНК СБОЙ: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
    }
  }

  async function runSyncSelectedDayGuarded() {
    if (syncInFlight) {
      setStatus("СИНК УЖЕ В ПРОЦЕССЕ", "busy");
      return;
    }
    syncInFlight = true;
    try {
      await runSyncSelectedDay();
    } finally {
      syncInFlight = false;
    }
  }

  async function runDatabaseSync() {
    if (!api?.syncDatabase) {
      setStatus("БД СИНК НЕДОСТУПЕН", "error");
      return;
    }

    setStatus("БД СИНК...", "busy");
    try {
      const result = await api.syncDatabase();
      if (!result?.ok) {
        const reason = String(result?.reason || "sync_failed").replaceAll("_", " ");
        setStatus(`БД СИНК СБОЙ: ${reason}`, "error");
        return;
      }

      await loadDate(selectedDateKey);
      const pushed = Number(result.pushedCount || 0);
      const applied = Number(result.appliedCount || 0);
      setStatus(`БД СИНК ОК: ↑${pushed} ↓${applied}`, "success");
    } catch (error) {
      setStatus(`БД СИНК СБОЙ: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
    }
  }

  async function runDatabaseSyncGuarded() {
    if (dbSyncInFlight) {
      setStatus("БД СИНК УЖЕ В ПРОЦЕССЕ", "busy");
      return;
    }
    dbSyncInFlight = true;
    try {
      await runDatabaseSync();
    } finally {
      dbSyncInFlight = false;
    }
  }

  async function dockWindowLeft() {
    if (!api?.dockWindowLeft) {
      setStatus("ПАНЕЛЬ НЕДОСТУПНА", "error");
      return;
    }

    try {
      await api.dockWindowLeft();
      setStatus("ПАНЕЛЬ СЛЕВА", "success");
    } catch (error) {
      setStatus(`СБОЙ ПАНЕЛИ: ${error instanceof Error ? error.message : "неизвестная ошибка"}`, "error");
    }
  }

  function handleLightweightAction(label) {
    const states = {
      "ТЕСТ": "ПРОВЕРКА КОНТУРА",
      "СИНК": "СИНХРОНИЗАЦИЯ НЕДОСТУПНА",
    };
    setStatus(states[label] || label, "busy");
  }

  updateClock();
  syncCalendarViewToSelected();
  setDateUI(selectedDateKey);

  dom.syncButton.addEventListener("click", runSyncSelectedDayGuarded);
  dom.dbSyncButton?.addEventListener("click", runDatabaseSyncGuarded);
  dom.dockButton?.addEventListener("click", dockWindowLeft);
  dom.prevDayButton.addEventListener("click", () => handleDateShift(-1));
  dom.nextDayButton.addEventListener("click", () => handleDateShift(1));
  dom.dateButton.addEventListener("click", openDatePicker);
  dom.datePopover?.addEventListener("click", handleCalendarClick);
  dom.dateInput.addEventListener("change", () => {
    if (dom.dateInput.value) {
      loadDate(dom.dateInput.value);
    }
  });
  dom.content.addEventListener("click", handleContentClick);
  dom.content.addEventListener("input", handleContentInput);
  dom.content.addEventListener("change", handleContentChange);
  dom.content.addEventListener("keydown", handleContentKeydown);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleGlobalKeydown);

  setInterval(() => {
    updateClock();
    updateFocusTimer();
    if (selectedDateKey && isToday(selectedDateKey)) {
      const minuteKey = currentMinuteKey();
      if (minuteKey !== lastLiveMinuteKey) {
        lastLiveMinuteKey = minuteKey;
        renderDay();
      }
    }
  }, 1000);

  loadDate(selectedDateKey);
})();

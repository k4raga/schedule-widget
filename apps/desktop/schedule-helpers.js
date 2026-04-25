(function exposeScheduleWidgetHelpers(root) {
  function parseDateKey(dateKey) {
    if (!dateKey) {
      return null;
    }
    const parsed = new Date(`${dateKey}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function toDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function shiftDateKey(dateKey, offsetDays) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return dateKey;
    }
    parsed.setDate(parsed.getDate() + offsetDays);
    return toDateKey(parsed);
  }

  function weekStartDateKey(dateKey) {
    const parsed = parseDateKey(dateKey);
    if (!parsed) {
      return dateKey;
    }
    const mondayOffset = (parsed.getDay() + 6) % 7;
    parsed.setDate(parsed.getDate() - mondayOffset);
    return toDateKey(parsed);
  }

  function weekEndDateKey(dateKey) {
    return shiftDateKey(weekStartDateKey(dateKey), 6);
  }

  function weeklySlotRange(slotIndex) {
    const startMinute = Math.max(0, Math.min(58, Number(slotIndex) || 0));
    return {
      startTime: `00:${String(startMinute).padStart(2, "0")}`,
      endTime: `00:${String(startMinute + 1).padStart(2, "0")}`,
    };
  }

  function taskScope(task) {
    return task?.scope === "week" ? "week" : "day";
  }

  function parseTaskListResponse(response) {
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.tasks)) {
      return response.tasks;
    }
    return [];
  }

  function sortWeeklyTasks(tasks, limit) {
    return tasks
      .filter((task) => taskScope(task) === "week")
      .slice()
      .sort((left, right) => {
        const bySlot = String(left?.startTime || "").localeCompare(String(right?.startTime || ""));
        if (bySlot !== 0) {
          return bySlot;
        }
        return String(left?.createdAt || "").localeCompare(String(right?.createdAt || ""));
      })
      .slice(0, limit);
  }

  function findWeeklyTaskForSlot(tasks, slotIndex) {
    const slotRange = weeklySlotRange(slotIndex);
    return tasks.find((task) => task.startTime === slotRange.startTime && task.endTime === slotRange.endTime) || null;
  }

  const helpers = {
    findWeeklyTaskForSlot,
    parseTaskListResponse,
    sortWeeklyTasks,
    taskScope,
    weekEndDateKey,
    weekStartDateKey,
    weeklySlotRange,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  }
  root.ScheduleWidgetHelpers = helpers;
})(typeof window !== "undefined" ? window : globalThis);

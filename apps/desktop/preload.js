const { contextBridge, ipcRenderer } = require("electron");

function ensureDateKey(dateKey) {
  if (typeof dateKey !== "string" || dateKey.trim().length === 0) {
    throw new Error("dateKey must be a non-empty string");
  }
}

function ensureCarryoverInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("carryover payload must be an object");
  }
  ensureDateKey(input.dateKey);
}

function ensureTaskInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("task payload must be an object");
  }
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new Error("title must be a non-empty string");
  }
  ensureDateKey(input.dateKey);
}

function ensureTaskMutationInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("task payload must be an object");
  }
  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error("id must be a non-empty string");
  }
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new Error("title must be a non-empty string");
  }
  ensureDateKey(input.dateKey);
}

function ensureDeleteTaskInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("task payload must be an object");
  }
  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error("id must be a non-empty string");
  }
}

function ensureSetStatusInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("task payload must be an object");
  }
  if (typeof input.id !== "string" || input.id.trim().length === 0) {
    throw new Error("id must be a non-empty string");
  }
  if (input.status !== "todo" && input.status !== "done") {
    throw new Error("status must be todo or done");
  }
}

function ensureRecurringSeriesInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("recurring payload must be an object");
  }
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    throw new Error("title must be a non-empty string");
  }
  if (typeof input.startTime !== "string" || !/^\d{2}:\d{2}$/.test(input.startTime)) {
    throw new Error("startTime must be an HH:MM string");
  }
  if (typeof input.endTime !== "string" || !/^\d{2}:\d{2}$/.test(input.endTime)) {
    throw new Error("endTime must be an HH:MM string");
  }
  ensureDateKey(input.anchorDate);
  if (!Array.isArray(input.dateKeys) || input.dateKeys.length === 0) {
    throw new Error("dateKeys must be a non-empty array");
  }
  input.dateKeys.forEach(ensureDateKey);
}

const api = {
  async getDayContext(dateKey) {
    ensureDateKey(dateKey);
    return ipcRenderer.invoke("v2:day-context:get", { dateKey });
  },

  async listTasks(dateKey) {
    ensureDateKey(dateKey);
    return ipcRenderer.invoke("v2:tasks:list", { dateKey });
  },

  async listCarryoverNotes(input) {
    ensureCarryoverInput(input);
    return ipcRenderer.invoke("v2:notes:carryover", {
      dateKey: input.dateKey,
      minStartTime: input.minStartTime || null,
      lookbackDays: input.lookbackDays || null,
    });
  },

  async createTask(input) {
    ensureTaskInput(input);
    return ipcRenderer.invoke("v2:tasks:create", {
      title: input.title.trim(),
      dateKey: input.dateKey,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      scope: input.scope || "day",
    });
  },

  async createRecurringTaskSeries(input) {
    ensureRecurringSeriesInput(input);
    return ipcRenderer.invoke("v2:tasks:create-recurring-series", {
      title: input.title.trim(),
      anchorDate: input.anchorDate,
      startTime: input.startTime,
      endTime: input.endTime,
      dateKeys: input.dateKeys,
    });
  },

  async updateTask(input) {
    ensureTaskMutationInput(input);
    return ipcRenderer.invoke("v2:tasks:update", {
      id: input.id.trim(),
      title: input.title.trim(),
      dateKey: input.dateKey,
      startTime: input.startTime || null,
      endTime: input.endTime || null,
      scope: input.scope || null,
    });
  },

  async deleteTask(input) {
    ensureDeleteTaskInput(input);
    return ipcRenderer.invoke("v2:tasks:delete", {
      id: input.id.trim(),
    });
  },

  async setTaskStatus(input) {
    ensureSetStatusInput(input);
    return ipcRenderer.invoke("v2:tasks:set-status", {
      id: input.id.trim(),
      status: input.status,
    });
  },

  async syncGoogleDay(input) {
    const dateKey = typeof input === "string" ? input : input?.dateKey;
    ensureDateKey(dateKey);
    return ipcRenderer.invoke("v2:sync:google-day", {
      dateKey,
    });
  },

  async syncDatabase() {
    return ipcRenderer.invoke("v2:sync:database");
  },

  async dockWindowLeft() {
    return ipcRenderer.invoke("v2:window:dock-left");
  }
};

contextBridge.exposeInMainWorld("v2DesktopAPI", api);

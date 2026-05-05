const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const { createV2MvpBackend } = require("../../packages/backend");

let backend = null;

function getSeedPath() {
  return path.resolve(__dirname, "..", "..", "tests", "fixtures", "v2-mvp-seed.json");
}

function getDatabasePath() {
  return path.join(app.getPath("userData"), "v2-mvp.sqlite");
}

function getAppIconPath() {
  return path.resolve(__dirname, "..", "..", "icon.ico");
}

function getSyncClientConfigPath() {
  return path.resolve(__dirname, "..", "..", "data", "sync-client.json");
}

function readSyncClientConfig() {
  let fileConfig = {};
  const configPath = getSyncClientConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
      fileConfig = {};
    }
  }

  return {
    serverUrl: process.env.WATSON_DESK_SYNC_SERVER_URL || fileConfig.serverUrl || "",
    token: process.env.WATSON_DESK_SYNC_TOKEN || fileConfig.token || "",
  };
}

async function ensureBackend() {
  if (!backend) {
    backend = await createV2MvpBackend({
      dbPath: getDatabasePath(),
      seedPath: getSeedPath(),
    });
  }
  return backend;
}

function registerIpcHandlers() {
  ipcMain.handle("v2:day-context:get", async (_event, payload = {}) => {
    const service = await ensureBackend();
    const context = await service.getDayContext({ date: payload.dateKey });
    return {
      dateKey: context.date,
      label: `Выбранная дата: ${context.date}`,
      tasks: context.tasks,
      externalEvents: context.externalEvents,
    };
  });

  ipcMain.handle("v2:tasks:list", async (_event, payload = {}) => {
    const service = await ensureBackend();
    const tasks = await service.listTasksForDate({ date: payload.dateKey });
    return { tasks };
  });

  ipcMain.handle("v2:notes:carryover", async (_event, payload = {}) => {
    const service = await ensureBackend();
    const tasks = await service.listCarryoverNotes({
      date: payload.dateKey,
      minStartTime: payload.minStartTime,
      lookbackDays: payload.lookbackDays,
    });
    return { tasks };
  });

  ipcMain.handle("v2:tasks:create", async (_event, payload = {}) => {
    const service = await ensureBackend();
    return service.createTask({
      title: payload.title,
      date: payload.dateKey,
      startTime: payload.startTime,
      endTime: payload.endTime,
      scope: payload.scope,
    });
  });

  ipcMain.handle("v2:tasks:create-recurring-series", async (_event, payload = {}) => {
    const service = await ensureBackend();
    return service.createRecurringTaskSeries({
      title: payload.title,
      anchorDate: payload.anchorDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      dateKeys: payload.dateKeys,
    });
  });

  ipcMain.handle("v2:tasks:update", async (_event, payload = {}) => {
    const service = await ensureBackend();
    return service.updateTask({
      id: payload.id,
      title: payload.title,
      date: payload.dateKey,
      startTime: payload.startTime,
      endTime: payload.endTime,
      scope: payload.scope,
    });
  });

  ipcMain.handle("v2:tasks:delete", async (_event, payload = {}) => {
    const service = await ensureBackend();
    return service.deleteTask({
      id: payload.id,
    });
  });

  ipcMain.handle("v2:tasks:set-status", async (_event, payload = {}) => {
    const service = await ensureBackend();
    return service.setTaskStatus({
      id: payload.id,
      status: payload.status,
    });
  });

  ipcMain.handle("v2:sync:google-day", async (_event, payload = {}) => {
    const service = await ensureBackend();
    return service.syncGoogleDayReadOnly({
      date: payload.dateKey,
      cwd: payload.cwd,
      timeZone: payload.timeZone,
    });
  });

  ipcMain.handle("v2:sync:database", async () => {
    const service = await ensureBackend();
    return service.syncDatabaseWithServer(readSyncClientConfig());
  });

  ipcMain.handle("v2:window:dock-left", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return { ok: false };
    }

    const display = screen.getDisplayMatching(win.getBounds());
    const workArea = display.workArea;
    const width = Math.min(Math.max(450, win.getMinimumSize()[0]), workArea.width);
    win.setBounds({
      x: workArea.x,
      y: workArea.y,
      width,
      height: workArea.height,
    }, true);
    return { ok: true };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 460,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: "#010203",
    title: "Расписание",
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: process.env.WATSON_DESK_V2_DEVTOOLS === "1",
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl !== win.webContents.getURL()) {
      event.preventDefault();
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));

  if (process.env.WATSON_DESK_V2_DEVTOOLS === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.k4raga.watson-desk");
  }
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (backend) {
    await backend.close();
    backend = null;
  }
});

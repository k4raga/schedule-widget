"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const readline = require("node:readline");

const DEFAULT_PORT = 3199;
const DEFAULT_DATA_DIR = path.join(process.cwd(), "data", "sync-server");

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function ensureDataDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function operationLogPath(dataDir) {
  return path.join(dataDir, "task-operations.jsonl");
}

function readOperations(dataDir) {
  const filePath = operationLogPath(dataDir);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function readOperationIds(dataDir) {
  const filePath = operationLogPath(dataDir);
  if (!fs.existsSync(filePath)) {
    return new Set();
  }

  const ids = new Set();
  const lines = readline.createInterface({
    crlfDelay: Infinity,
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
  });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    ids.add(JSON.parse(trimmed).id);
  }

  return ids;
}

async function appendOperations(dataDir, operations) {
  if (!operations.length) {
    return 0;
  }

  ensureDataDir(dataDir);
  const filePath = operationLogPath(dataDir);
  const existingIds = await readOperationIds(dataDir);
  const unique = operations.filter((operation) => !existingIds.has(operation.id));
  if (!unique.length) {
    return 0;
  }

  const payload = unique.map((operation) => `${JSON.stringify(operation)}\n`).join("");
  await fs.promises.appendFile(filePath, payload, "utf8");
  return unique.length;
}

function normalizeOperation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("operation must be an object");
  }
  const id = String(input.id || "").trim();
  const clientId = String(input.clientId || "").trim();
  const type = String(input.type || "").trim();
  const entityId = String(input.entityId || "").trim();
  const createdAt = String(input.createdAt || "").trim();
  if (!id || !clientId || !entityId || !createdAt) {
    throw new Error("operation id, clientId, entityId and createdAt are required");
  }
  if (type !== "upsert_task" && type !== "delete_task") {
    throw new Error("operation type must be upsert_task or delete_task");
  }
  if (type === "upsert_task" && (!input.task || typeof input.task !== "object")) {
    throw new Error("upsert_task operation requires task");
  }
  return {
    id,
    clientId,
    type,
    entityId,
    createdAt,
    task: type === "upsert_task" ? input.task : null,
  };
}

function isAuthorized(request, token) {
  const header = String(request.headers.authorization || "");
  return header === `Bearer ${token}`;
}

function createSyncServer(options = {}) {
  const token = String(options.token || process.env.WATSON_DESK_SYNC_TOKEN || "").trim();
  if (!token) {
    throw new Error("WATSON_DESK_SYNC_TOKEN is required");
  }

  const dataDir = options.dataDir || process.env.WATSON_DESK_SYNC_DATA_DIR || DEFAULT_DATA_DIR;
  ensureDataDir(dataDir);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");

      if (url.pathname === "/health") {
        writeJson(response, 200, { ok: true });
        return;
      }

      if (!isAuthorized(request, token)) {
        writeJson(response, 401, { ok: false, reason: "unauthorized" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/sync/operations") {
        writeJson(response, 200, { ok: true, operations: readOperations(dataDir) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/sync/push") {
        const body = await readJsonBody(request);
        const operations = Array.isArray(body.operations) ? body.operations.map(normalizeOperation) : [];
        const acceptedCount = await appendOperations(dataDir, operations);
        writeJson(response, 200, { ok: true, acceptedCount });
        return;
      }

      writeJson(response, 404, { ok: false, reason: "not_found" });
    } catch (error) {
      writeJson(response, 400, {
        ok: false,
        reason: error instanceof Error ? error.message : "bad_request",
      });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.WATSON_DESK_SYNC_PORT || DEFAULT_PORT);
  const host = process.env.WATSON_DESK_SYNC_HOST || "0.0.0.0";
  const server = createSyncServer();
  server.listen(port, host, () => {
    console.log(`watson-desk sync server listening on http://${host}:${port}`);
  });
}

module.exports = {
  createSyncServer,
  readOperations,
};

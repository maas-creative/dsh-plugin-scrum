#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vendor/session-finder-independent/src/json.ts
import { readFileSync } from "node:fs";
function asMap(value) {
  return isMap(value) ? value : null;
}
function text(value) {
  return typeof value === "string" ? value : null;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function parseJsonText(value) {
  try {
    return jsonFromUnknown(JSON.parse(value)) ?? null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}
function readJson(path) {
  try {
    return parseJsonText(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return null;
    }
    throw error;
  }
}
function readJsonl(path) {
  try {
    return readFileSync(path, "utf8").split(/\r?\n/u).flatMap((line) => {
      if (line.trim() === "") {
        return [];
      }
      const parsed = parseJsonText(line);
      const map = asMap(parsed ?? void 0);
      return map === null ? [] : [map];
    });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return [];
    }
    throw error;
  }
}
function isMap(value) {
  return value !== void 0 && value !== null && typeof value === "object" && !Array.isArray(value);
}
function jsonMapFromUnknown(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const json = jsonFromUnknown(item);
    if (json === void 0) {
      return null;
    }
    result[key] = json;
  }
  return result;
}
function jsonFromUnknown(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const items = value.map(jsonFromUnknown);
    return items.every((item) => item !== void 0) ? items : void 0;
  }
  return jsonMapFromUnknown(value) ?? void 0;
}
var init_json = __esm({
  "vendor/session-finder-independent/src/json.ts"() {
  }
});

// vendor/session-finder-independent/src/content.ts
import { dirname } from "node:path";
function contentText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const map = asMap(item);
      if (map === null) {
        return [];
      }
      return [text(map["text"]) ?? text(map["content"]) ?? ""];
    }).filter((part) => part !== "").join("\n");
  }
  return "";
}
function contentFromMaybeJson(value) {
  const parsed = typeof value === "string" ? parseJsonText(value) : value;
  return contentText(parsed ?? void 0) || (typeof value === "string" ? value : "");
}
function userText(data, message) {
  if (data["type"] === "user") {
    const value = contentText(data["content"]);
    if (value !== "") {
      return value;
    }
  }
  return message["role"] === "user" ? contentText(message["content"]) : "";
}
function nickRole(nickname, role) {
  if (nickname !== null && role !== null) {
    return `${nickname} (${role})`;
  }
  return nickname ?? role;
}
function spawnInfo(source) {
  const parsed = typeof source === "string" ? parseJsonText(source) : source;
  const data = asMap(parsed);
  const subagent = data === null ? void 0 : data["subagent"];
  if (typeof subagent === "string") {
    return [null, subagent];
  }
  const subagentMap = asMap(subagent);
  const spawn = asMap(subagentMap?.["thread_spawn"]);
  if (spawn === null) {
    return [null, null];
  }
  return [
    text(spawn["parent_thread_id"]),
    nickRole(text(spawn["agent_nickname"]), text(spawn["agent_role"]))
  ];
}
function stemId(path, marker) {
  const stem = path.split("/").at(-1)?.replace(/\.[^.]+$/u, "") ?? path;
  return stem.split(marker).at(-1)?.split("_").at(-1) ?? stem;
}
function parentDirName(path) {
  return dirname(path).split("/").at(-1) ?? "";
}
function toSessionJson(item) {
  return {
    platform: item.platform,
    id: item.id,
    path: item.path,
    cwd: item.cwd,
    created_at: item.created_at,
    updated_at: item.updated_at,
    provider: item.provider,
    model: item.model,
    first_user_message: item.first_user_message.slice(0, 300),
    last_user_message: (item.last_user_message || item.first_user_message).slice(0, 300),
    usage: item.usage,
    parent_id: item.parent_id,
    agent: item.agent
  };
}
var init_content = __esm({
  "vendor/session-finder-independent/src/content.ts"() {
    init_json();
  }
});

// vendor/session-finder-independent/src/fs.ts
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function homePath(...parts) {
  return join(homedir(), ...parts);
}
function appDataPath() {
  return process.env["APPDATA"] ?? "";
}
function existing(paths) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const path of paths) {
    if (path !== "" && existsSync(path) && !seen.has(path)) {
      seen.add(path);
      result.push(path);
    }
  }
  return result;
}
function recent(paths) {
  return paths.map((path) => ({ path, mtime: safeMtime(path) })).sort((left, right) => right.mtime - left.mtime).slice(0, maxPlatformFiles).map((item) => item.path);
}
function globFiles(root, matcher) {
  if (!existsSync(root)) {
    return [];
  }
  const result = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === void 0) {
      continue;
    }
    for (const entry of safeReadDirEntries(current)) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relative = path.slice(root.length + 1);
      if (matcher(relative, entry.name)) {
        result.push(path);
      }
    }
  }
  return result;
}
function safeReadDirEntries(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return [];
    }
    throw error;
  }
}
function safeStat(path) {
  try {
    return statSync(path);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return null;
    }
    throw error;
  }
}
function safeMtime(path) {
  const value = safeStat(path)?.mtimeMs ?? 0;
  return typeof value === "bigint" ? Number(value) : value;
}
var maxPlatformFiles;
var init_fs = __esm({
  "vendor/session-finder-independent/src/fs.ts"() {
    maxPlatformFiles = 2e3;
  }
});

// vendor/session-finder-independent/src/time.ts
import { statSync as statSync2 } from "node:fs";
function unixSeconds(value) {
  return value === null ? null : new Date(value * 1e3).toISOString();
}
function unixMillis(value) {
  return value === null ? null : new Date(value).toISOString();
}
function fileTime(path) {
  try {
    return statSync2(path).mtime.toISOString();
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return null;
    }
    throw error;
  }
}
function parseStamp(value) {
  if (value === null) {
    return null;
  }
  const stamp = new Date(value);
  return Number.isNaN(stamp.getTime()) ? null : stamp;
}
function dateBound(value, end = false) {
  if (value === null) {
    return null;
  }
  const text2 = value.trim().toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayMs = 864e5;
  if (text2 === "today") {
    return new Date(today.getTime() + (end ? dayMs : 0));
  }
  if (text2 === "yesterday") {
    return new Date(today.getTime() - dayMs + (end ? dayMs : 0));
  }
  if (/^\d+d$/u.test(text2)) {
    const days = Number.parseInt(text2.slice(0, -1), 10);
    return new Date(today.getTime() - days * dayMs + (end ? dayMs : 0));
  }
  const parts = text2.split("-").map((part) => Number.parseInt(part, 10));
  const year = parts[0];
  if (year === void 0 || Number.isNaN(year)) {
    return null;
  }
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const base = new Date(Date.UTC(year, month - 1, day));
  if (!end) {
    return base;
  }
  if (parts.length >= 3) {
    return new Date(base.getTime() + dayMs);
  }
  if (parts.length === 2) {
    return new Date(Date.UTC(year, month, 1));
  }
  return new Date(Date.UTC(year + 1, 0, 1));
}
var init_time = __esm({
  "vendor/session-finder-independent/src/time.ts"() {
  }
});

// vendor/session-finder-independent/src/event-text.ts
function eventMatchReasons(item, events, query, needle) {
  return events.flatMap((event) => {
    const value = safeEventText(event);
    return value.toLowerCase().includes(needle) ? [{ query, platform: item.platform, field: "event", snippet: snippet(value, needle) }] : [];
  });
}
function matchedEvents(events, opts) {
  return opts.eventQueries.flatMap((query) => {
    const needle = query.toLowerCase();
    return events.flatMap((event, index) => {
      const value = safeEventText(event);
      const map = asMap(event);
      return value.toLowerCase().includes(needle) ? [
        {
          event_index: index,
          event_type: text(map?.["type"]),
          timestamp: text(map?.["timestamp"]),
          query,
          snippet: snippet(value, needle, opts.excerptChars)
        }
      ] : [];
    });
  });
}
function snippet(value, needle, width = 160) {
  const start = Math.max(value.toLowerCase().indexOf(needle) - 60, 0);
  return value.slice(start, Math.min(start + width, value.length));
}
function safeEventText(event) {
  return redactSensitiveText(JSON.stringify(redactedJson(event)) ?? "");
}
function redactedJson(value) {
  if (Array.isArray(value)) {
    return value.map(redactedJson);
  }
  const map = asMap(value);
  if (map === null) {
    return value;
  }
  const result = {};
  for (const [key, item] of Object.entries(map)) {
    result[key] = isSensitiveKey(key) ? "[REDACTED]" : redactedJson(item);
  }
  return result;
}
function isSensitiveKey(key) {
  return /auth|authorization|bearer|token|secret|password|api[_-]?key/iu.test(key);
}
function redactSensitiveText(value) {
  if (!isSensitiveKey(value)) {
    return value;
  }
  return value.replace(
    /(authorization)(\\?["']?\s*[:=]\s*\\?["']?\s*bearer\s+)[^"',\s}]+/giu,
    "$1$2[REDACTED]"
  ).replace(/(bearer\s+)[^"',\s}]+/giu, "$1[REDACTED]").replace(
    /(authorization)(\\?["']?\s*[:=]\s*\\?["']?\s*)(?!bearer\b)[^"',\s}]+/giu,
    "$1$2[REDACTED]"
  ).replace(
    /(api[_-]?key|token|password|secret)(\\?["']?\s*[:=]\s*\\?["']?)[^"',\s}]+/giu,
    "$1$2[REDACTED]"
  );
}
var init_event_text = __esm({
  "vendor/session-finder-independent/src/event-text.ts"() {
    init_json();
  }
});

// vendor/session-finder-independent/src/scanners/jsonl.ts
import { readFileSync as readFileSync2 } from "node:fs";
function jsonlSession(platform, path, fallbackId2) {
  let id = fallbackId2;
  let cwd = null;
  let provider = null;
  let model = null;
  let parent = null;
  let agent = null;
  let firstUser3 = "";
  let lastUser = "";
  let created = null;
  let updated = null;
  const usage3 = {};
  const eventTextParts = [];
  const promptTextParts = [];
  for (const entry of readJsonlRecords(path)) {
    const data = entry.record;
    const eventType = stringValue(data["type"]);
    id = stringValue(data["sessionId"]) ?? (eventType === "session" ? stringValue(data["id"]) : null) ?? id;
    cwd = cwd ?? stringValue(data["cwd"]);
    created = created ?? stringValue(data["timestamp"]);
    updated = stringValue(data["timestamp"]) ?? updated;
    provider = provider ?? stringValue(data["provider"]);
    model = model ?? stringValue(data["modelId"]) ?? stringValue(data["model"]);
    const payload = recordValue(data["payload"]);
    if (eventType === "session_meta" && payload !== null) {
      id = stringValue(payload["id"]) ?? id;
      cwd = cwd ?? stringValue(payload["cwd"]);
      provider = provider ?? stringValue(payload["model_provider"]);
      const [sourceParent, sourceAgent] = spawnInfo(jsonValue(payload["source"]));
      parent = parent ?? sourceParent;
      agent = agent ?? sourceAgent ?? nickRole(stringValue(payload["agent_nickname"]), stringValue(payload["agent_role"]));
    }
    const message = recordValue(data["message"]) ?? payload ?? {};
    provider = provider ?? stringValue(message["provider"]);
    model = model ?? stringValue(message["model"]);
    const prompt = userTextRecord(data, message);
    if (prompt !== "") {
      firstUser3 ||= prompt;
      lastUser = prompt;
      promptTextParts.push(entry.text);
    }
    if (prompt === "" && eventType !== "session_meta") {
      eventTextParts.push(redactSensitiveText(entry.text));
    }
    mergeUsageRecord(usage3, recordValue(message["usage"]) ?? recordValue(data["usage"]));
  }
  eventTextParts.push(...promptTextParts.slice(1, -1).map(redactSensitiveText));
  const eventSearchText = eventTextParts.join("\n");
  return {
    platform,
    id,
    path,
    cwd,
    created_at: created ?? fileTime(path),
    updated_at: updated ?? created ?? fileTime(path),
    provider,
    model,
    first_user_message: firstUser3,
    last_user_message: lastUser,
    usage: usage3,
    parent_id: parent,
    agent,
    event_search_indexed: true,
    ...eventSearchText === "" ? {} : {
      event_search_text: eventSearchText,
      event_search_text_lower: eventSearchText.toLowerCase()
    }
  };
}
function readJsonlRecords(path) {
  try {
    const result = [];
    const text2 = readFileSync2(path, "utf8");
    for (const line of text2.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed);
        const record = recordValue(parsed);
        if (record !== null) {
          result.push({ record, text: trimmed });
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          continue;
        }
        throw error;
      }
    }
    return result;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return [];
    }
    throw error;
  }
}
function recordValue(value) {
  return isRecord(value) ? value : null;
}
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringValue(value) {
  return typeof value === "string" ? value : null;
}
function userTextRecord(data, message) {
  if (data["type"] === "user") {
    const value = contentTextValue(data["content"]);
    if (value !== "") {
      return value;
    }
  }
  return message["role"] === "user" ? contentTextValue(message["content"]) : "";
}
function contentTextValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }
  return value.flatMap((item) => {
    const map = recordValue(item);
    if (map === null) {
      return [];
    }
    return [stringValue(map["text"]) ?? stringValue(map["content"]) ?? ""];
  }).filter((part) => part !== "").join("\n");
}
function mergeUsageRecord(target, value) {
  if (value === null) {
    return;
  }
  for (const key of ["totalTokens", "total_tokens", "input", "output", "cacheRead", "cacheWrite"]) {
    const item = jsonValue(value[key]);
    if (item !== void 0) {
      target[key] = item;
    }
  }
  const cost = recordValue(value["cost"]);
  const total = cost === null ? void 0 : jsonValue(cost["total"]);
  if (total !== void 0) {
    target["cost_total"] = total;
  }
}
function jsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    const items = value.map(jsonValue);
    return items.every((item) => item !== void 0) ? items : void 0;
  }
  const record = recordValue(value);
  if (record === null) {
    return void 0;
  }
  const result = {};
  for (const [key, item] of Object.entries(record)) {
    const parsed = jsonValue(item);
    if (parsed === void 0) {
      return void 0;
    }
    result[key] = parsed;
  }
  return result;
}
function fallbackId(path, marker) {
  return stemId(path, marker);
}
var init_jsonl = __esm({
  "vendor/session-finder-independent/src/scanners/jsonl.ts"() {
    init_content();
    init_event_text();
    init_time();
  }
});

// vendor/session-finder-independent/src/scanners/codex.ts
var codex_exports = {};
__export(codex_exports, {
  scanCodex: () => scanCodex
});
import { join as join2 } from "node:path";
async function scanCodex(extraRoots, rootsOnly = false) {
  const roots = rootsOnly ? existing(extraRoots) : existing([
    process.env["CODEX_HOME"] ?? "",
    ...knownCodexHomeDirs.map((name) => homePath(name)),
    ...extraRoots
  ]);
  const dbs = roots.flatMap(
    (root) => globFiles(
      root,
      (relative, name) => name.startsWith("state_") && name.endsWith(".sqlite") && !relative.includes("/")
    )
  );
  const rollouts = roots.flatMap((root) => [
    ...globFiles(
      join2(root, "sessions"),
      (_relative, name) => name.startsWith("rollout-") && name.endsWith(".jsonl")
    ),
    ...globFiles(
      join2(root, "archived_sessions"),
      (_relative, name) => name.startsWith("rollout-") && name.endsWith(".jsonl")
    )
  ]);
  const dbSessions2 = await Promise.all(dbs.map((path) => codexDb(path)));
  return [
    ...dbSessions2.flat(),
    ...recent(rollouts).map((path) => jsonlSession("codex", path, fallbackId(path, "rollout-")))
  ];
}
async function codexDb(path) {
  try {
    const { DatabaseSync: DatabaseSync4 } = await import("node:sqlite");
    const db = new DatabaseSync4(path, { readOnly: true });
    try {
      const edges = spawnEdges(db);
      const rows2 = rowsFor(db);
      return rows2.map((row) => codexRow(path, row, edges));
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      return [];
    }
    throw error;
  }
}
function rowsFor(db) {
  try {
    return db.prepare(threadsSql).all().flatMap(rowFromUnknown);
  } catch (error) {
    if (error instanceof Error) {
      return db.prepare(legacyThreadsSql).all().flatMap(rowFromUnknown);
    }
    throw error;
  }
}
function spawnEdges(db) {
  try {
    const rows2 = db.prepare("SELECT child_thread_id, parent_thread_id FROM thread_spawn_edges").all().flatMap(rowFromUnknown);
    return new Map(
      rows2.flatMap((row) => {
        const child = text(row["child_thread_id"]);
        const parent = text(row["parent_thread_id"]);
        return child === null || parent === null ? [] : [[child, parent]];
      })
    );
  } catch (error) {
    if (error instanceof Error) {
      return /* @__PURE__ */ new Map();
    }
    throw error;
  }
}
function codexRow(path, row, edges) {
  const id = text(row["id"]) ?? "";
  const [sourceParent, sourceAgent] = spawnInfo(row["source"]);
  const usageValue = numberValue(row["tokens_used"]);
  return {
    platform: "codex",
    id,
    path: text(row["rollout_path"]) ?? path,
    cwd: text(row["cwd"]),
    created_at: unixSeconds(numberValue(row["created_at"])),
    updated_at: unixSeconds(numberValue(row["updated_at"])),
    provider: text(row["model_provider"]),
    model: text(row["model"]),
    first_user_message: text(row["first_user_message"]) ?? "",
    last_user_message: text(row["first_user_message"]) ?? "",
    usage: { total_tokens: usageValue },
    parent_id: edges.get(id) ?? sourceParent,
    agent: nickRole(text(row["agent_nickname"]), text(row["agent_role"])) ?? sourceAgent
  };
}
function rowFromUnknown(value) {
  const row = jsonMapFromUnknown(value);
  return row === null ? [] : [row];
}
var knownCodexHomeDirs, threadsSql, legacyThreadsSql;
var init_codex = __esm({
  "vendor/session-finder-independent/src/scanners/codex.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
    init_jsonl();
    knownCodexHomeDirs = [
      ".codex",
      ".codex-local-gui-cli-remote",
      ".codex-gui-cli-remote",
      ".codex-gui-cli"
    ];
    threadsSql = "SELECT id, rollout_path, cwd, created_at, updated_at, model_provider, model, first_user_message, tokens_used, source, agent_nickname, agent_role FROM threads";
    legacyThreadsSql = "SELECT id, rollout_path, cwd, created_at, updated_at, model_provider, model, first_user_message, tokens_used FROM threads";
  }
});

// vendor/session-finder-independent/src/scanners/claude.ts
var claude_exports = {};
__export(claude_exports, {
  scanClaude: () => scanClaude
});
import { join as join3 } from "node:path";
function scanClaude(extraRoots, rootsOnly = false) {
  const roots = rootsOnly ? existing(extraRoots) : existing([homePath(".claude"), join3(appDataPath(), "Claude"), ...extraRoots]);
  const mains = roots.flatMap((root) => [
    ...globFiles(join3(root, "transcripts"), (_relative, name) => name.endsWith(".jsonl")),
    ...globFiles(
      join3(root, "projects"),
      (relative, name) => name.endsWith(".jsonl") && relative.split("/").length === 2
    ),
    ...globFiles(
      join3(root, "pre-compact-session-histories"),
      (_relative, name) => name.endsWith(".jsonl")
    )
  ]);
  const children = roots.flatMap(
    (root) => globFiles(
      join3(root, "projects"),
      (relative, name) => relative.includes("/subagents/") && name.startsWith("agent-") && name.endsWith(".jsonl")
    )
  );
  return [
    ...recent(mains).map(
      (path) => jsonlSession("claude", path, path.split("/").at(-1)?.replace(".jsonl", "") ?? path)
    ),
    ...recent(children).flatMap((path) => subagentSession(path))
  ];
}
function subagentSession(path) {
  const parts = path.split("/");
  const subIndex = parts.indexOf("subagents");
  const parentId = parts[subIndex - 1];
  if (subIndex < 1 || parentId === void 0) {
    return [];
  }
  const meta = asMap(readJson(path.replace(/\.jsonl$/u, ".meta.json")) ?? void 0) ?? {};
  const first = readJsonl(path)[0] ?? {};
  const message = asMap(first["message"]) ?? {};
  const description = text(meta["description"]) ?? "";
  const task = contentText(message["content"]);
  const prompt = [description, task].filter((part) => part !== "").join("\n");
  const created = text(first["timestamp"]) ?? fileTime(path);
  return [
    {
      platform: "claude",
      id: path.split("/").at(-1)?.replace(/^agent-/u, "").replace(/\.jsonl$/u, "") ?? path,
      path,
      cwd: text(first["cwd"]),
      created_at: created,
      updated_at: fileTime(path) ?? created,
      provider: null,
      model: null,
      first_user_message: prompt,
      last_user_message: prompt,
      usage: {},
      parent_id: parentId,
      agent: text(meta["agentType"])
    }
  ];
}
var init_claude = __esm({
  "vendor/session-finder-independent/src/scanners/claude.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
    init_jsonl();
  }
});

// vendor/session-finder-independent/src/scanners/aside.ts
var aside_exports = {};
__export(aside_exports, {
  scanAside: () => scanAside
});
import { join as join4 } from "node:path";
function scanAside(extraRoots, rootsOnly = false) {
  const roots = rootsOnly ? existing(extraRoots) : rootsFor([homePath(".aside")], extraRoots, [".aside"]);
  const paths = roots.flatMap(
    (root) => globFiles(
      root,
      (relative, name) => name === "messages.jsonl" && (relative.includes("/sessions/") || relative === "messages.jsonl")
    )
  );
  return recent(paths).flatMap((path) => asideSession(path));
}
function asideSession(path) {
  let firstUser3 = "";
  let lastUser = "";
  let created = null;
  let updated = null;
  let provider = null;
  let model = null;
  let count = 0;
  const usage3 = {};
  for (const row of readJsonl(path)) {
    count += 1;
    const stamp = unixMillis(numberValue(row["timestamp"]));
    created = created ?? stamp;
    updated = stamp ?? updated;
    provider = provider ?? text(row["provider"]);
    model = model ?? text(row["model"]);
    if (row["role"] === "user") {
      const prompt = contentText(row["content"]);
      if (prompt !== "") {
        firstUser3 ||= prompt;
        lastUser = prompt;
      }
    }
    mergeAsideUsage(usage3, asMap(row["usage"]));
  }
  if (count === 0) {
    return [];
  }
  usage3["message_count"] = count;
  return [
    {
      platform: "aside",
      id: path.split("/").at(-2) ?? path,
      path,
      cwd: null,
      created_at: created ?? fileTime(path),
      updated_at: updated ?? created ?? fileTime(path),
      provider,
      model,
      first_user_message: firstUser3,
      last_user_message: lastUser,
      usage: usage3,
      parent_id: null,
      agent: null
    }
  ];
}
function mergeAsideUsage(target, value) {
  if (value === null) {
    return;
  }
  for (const key of usageKeys) {
    const item = typeof value[key] === "number" ? value[key] : null;
    if (item !== null) {
      target[key] = (typeof target[key] === "number" ? target[key] : 0) + item;
    }
  }
  const cost = asMap(value["cost"]);
  const total = numberValue(cost?.["total"]);
  if (total !== null) {
    target["cost_total"] = (typeof target["cost_total"] === "number" ? target["cost_total"] : 0) + total;
  }
}
function rootsFor(defaults, extraRoots, children) {
  return existing([
    ...defaults,
    ...extraRoots.flatMap((root) => [root, ...children.map((child) => join4(root, child))])
  ]);
}
var usageKeys;
var init_aside = __esm({
  "vendor/session-finder-independent/src/scanners/aside.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
    usageKeys = ["input", "output", "cacheRead", "cacheWrite", "cacheWrite1h", "totalTokens"];
  }
});

// vendor/session-finder-independent/src/scanners/opencode.ts
var opencode_exports = {};
__export(opencode_exports, {
  scanOpenCode: () => scanOpenCode
});
import { execFileSync } from "node:child_process";
import { existsSync as existsSync2 } from "node:fs";
import { join as join5 } from "node:path";
import { DatabaseSync } from "node:sqlite";
function scanOpenCode(extraRoots, rootsOnly = false) {
  if (extraRoots.length === 0 && !rootsOnly) {
    const db = dbSessions();
    if (db.length > 0) {
      return db;
    }
    const cli = cliSessions();
    if (cli.length > 0) {
      return cli;
    }
  }
  const roots = rootsOnly ? existing(extraRoots) : existing([
    process.env["OPENCODE_HOME"] ?? "",
    homePath(".opencode"),
    homePath(".local", "share", "opencode"),
    join5(appDataPath(), "opencode"),
    ...extraRoots
  ]);
  const storage = roots.flatMap(
    (root) => globFiles(
      join5(root, "storage", "session"),
      (_relative, name) => name.startsWith("ses_") && name.endsWith(".json")
    )
  );
  return recent(storage).flatMap((path) => storageSession(path));
}
function dbSessions() {
  const path = dbPath();
  if (path === null) {
    return [];
  }
  try {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      return rows(db).map((row) => dbSession(row));
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      return [];
    }
    throw error;
  }
}
function rows(db) {
  try {
    return db.prepare(sessionSql).all().flatMap(rowFromUnknown2);
  } catch (error) {
    if (error instanceof Error) {
      return db.prepare(legacySql).all().flatMap(rowFromUnknown2);
    }
    throw error;
  }
}
function dbPath() {
  const cliPath = opencodeText(["db", "path"])?.trim();
  for (const candidate of [
    cliPath ?? "",
    homePath(".local", "share", "opencode", "opencode.db"),
    join5(appDataPath(), "opencode", "opencode.db")
  ]) {
    if (candidate !== "" && existsSync2(candidate)) {
      return candidate;
    }
  }
  return null;
}
function dbSession(row) {
  const id = text(row["id"]) ?? "";
  const model = asMap(parseJsonText(text(row["model"]) ?? "") ?? void 0);
  return {
    platform: "opencode",
    id,
    path: `opencode://${id}`,
    cwd: text(row["directory"]),
    created_at: unixMillis(numberValue(row["time_created"])),
    updated_at: unixMillis(numberValue(row["time_updated"])),
    provider: text(model?.["providerID"]),
    model: text(model?.["id"]),
    first_user_message: text(row["title"]) ?? "",
    last_user_message: text(row["title"]) ?? "",
    usage: usage(row),
    parent_id: text(row["parent_id"]),
    agent: text(row["agent"])
  };
}
function storageSession(path) {
  const info = asMap(readJson(path) ?? void 0);
  if (info === null) {
    return [];
  }
  const time = asMap(info["time"]) ?? {};
  return [
    {
      platform: "opencode",
      id: text(info["id"]) ?? path.split("/").at(-1)?.replace(".json", "") ?? path,
      path,
      cwd: text(info["directory"]),
      created_at: unixMillis(numberValue(time["created"])),
      updated_at: unixMillis(numberValue(time["updated"])),
      provider: null,
      model: null,
      first_user_message: text(info["title"]) ?? "",
      last_user_message: text(info["title"]) ?? "",
      usage: {},
      parent_id: text(info["parentID"]),
      agent: text(info["agent"])
    }
  ];
}
function cliSessions() {
  const raw = opencodeText(["session", "list", "--format", "json", "--max-count", "100"]);
  const parsed = raw === null ? null : parseJsonText(raw);
  return Array.isArray(parsed) ? parsed.flatMap((item) => cliSession(asMap(item))) : [];
}
function cliSession(item) {
  if (item === null) {
    return [];
  }
  const id = text(item["id"]) ?? "";
  return [
    {
      platform: "opencode",
      id,
      path: `opencode://${id}`,
      cwd: text(item["directory"]),
      created_at: unixMillis(numberValue(item["created"])),
      updated_at: unixMillis(numberValue(item["updated"])),
      provider: null,
      model: null,
      first_user_message: text(item["title"]) ?? "",
      last_user_message: text(item["title"]) ?? "",
      usage: usage(item),
      parent_id: null,
      agent: null
    }
  ];
}
function usage(row) {
  const result = {};
  const fields = [
    ["cost", "cost_total"],
    ["tokens_input", "input"],
    ["tokens_output", "output"],
    ["tokens_reasoning", "reasoning"],
    ["tokens_cache_read", "cacheRead"],
    ["tokens_cache_write", "cacheWrite"]
  ];
  for (const [field, key] of fields) {
    const value = numberValue(row[field]);
    if (value !== null) {
      result[key] = value;
    }
  }
  return result;
}
function rowFromUnknown2(value) {
  const row = jsonMapFromUnknown(value);
  return row === null ? [] : [row];
}
function opencodeText(args) {
  try {
    return execFileSync("opencode", args, { encoding: "utf8", timeout: 8e3 });
  } catch (error) {
    if (error instanceof Error) {
      return null;
    }
    throw error;
  }
}
var sessionSql, legacySql;
var init_opencode = __esm({
  "vendor/session-finder-independent/src/scanners/opencode.ts"() {
    init_fs();
    init_json();
    init_time();
    sessionSql = "select id, title, directory, time_created, time_updated, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, model, parent_id, agent from session where time_archived is null order by time_updated desc limit 50000";
    legacySql = "select id, title, directory, time_created, time_updated, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, model from session where time_archived is null order by time_updated desc limit 2000";
  }
});

// vendor/session-finder-independent/src/scanners/generic.ts
var generic_exports = {};
__export(generic_exports, {
  filePlatforms: () => filePlatforms,
  scanAider: () => scanAider,
  scanFilePlatform: () => scanFilePlatform
});
import { readFileSync as readFileSync3 } from "node:fs";
import { join as join6 } from "node:path";
function scanFilePlatform(config, extraRoots, rootsOnly = false) {
  const roots = rootsOnly ? existing(extraRoots) : existing([
    ...config.roots,
    ...extraRoots.flatMap((root) => [
      root,
      ...config.children.map((child) => join6(root, child))
    ])
  ]);
  const paths = roots.flatMap((root) => globFiles(root, config.matcher));
  return recent(paths).flatMap((path) => config.reader(config.platform, path));
}
function scanAider(extraRoots) {
  const roots = existing([homePath("local-workspaces"), homePath("indent"), ...extraRoots]);
  const paths = roots.flatMap(
    (root) => globFiles(root, (_relative, name) => name === ".aider.chat.history.md")
  );
  return recent(paths).flatMap((path) => {
    const textValue = readFileSync3(path, "utf8");
    return textValue.split("# aider chat started at ").flatMap((block) => {
      if (block.trim() === "") {
        return [];
      }
      const [firstLine = "", ...body] = block.split(/\r?\n/u);
      const prompt = body.find((line) => line.startsWith("#### "))?.replace(/^#### /u, "").trim() ?? "";
      return [
        basicSession(
          "aider",
          `${parentDirName(path)}-${firstLine.replaceAll(":", "-").replaceAll(" ", "-")}`,
          path,
          prompt
        )
      ];
    });
  });
}
function jsonlPlatform(platform, roots, children, matcher) {
  return {
    platform,
    roots,
    children,
    matcher,
    reader: (name, path) => [
      jsonlSession(name, path, fallbackId(path, name === "openclaw" ? "" : "_"))
    ]
  };
}
function jsonPlatform(platform, roots, children) {
  return {
    platform,
    roots,
    children,
    matcher: (_relative, name) => name.endsWith(".json") && !name.endsWith(".meta.json"),
    reader: (name, path) => jsonSessions(name, path)
  };
}
function jsonSessions(platform, path) {
  const data = readJson(path);
  const rows2 = Array.isArray(data) ? data.flatMap(jsonMapFrom) : [];
  const map = asMap(data ?? void 0);
  const messages = rows2.length > 0 ? rows2 : messageArray(map);
  const prompt = firstUser(messages) || text(map?.["title"]) || "";
  return prompt === "" && map === null ? [] : [basicSession(platform, text(map?.["id"]) ?? parentDirName(path), path, prompt)];
}
function messageArray(map) {
  for (const key of ["messages", "turns", "entries"]) {
    const value = map?.[key];
    if (Array.isArray(value)) {
      return value.flatMap(jsonMapFrom);
    }
  }
  return [];
}
function firstUser(messages) {
  for (const message of messages) {
    if (text(message["role"]) === "user" || text(message["type"]) === "user") {
      const prompt = contentFromMaybeJson(message["content"]);
      if (prompt !== "") {
        return prompt;
      }
    }
  }
  return "";
}
function basicSession(platform, id, path, prompt) {
  return {
    platform,
    id,
    path,
    cwd: null,
    created_at: fileTime(path),
    updated_at: fileTime(path),
    provider: null,
    model: null,
    first_user_message: prompt,
    last_user_message: prompt,
    usage: {},
    parent_id: null,
    agent: null
  };
}
function jsonMapFrom(value) {
  const map = asMap(value);
  return map === null ? [] : [map];
}
var filePlatforms;
var init_generic = __esm({
  "vendor/session-finder-independent/src/scanners/generic.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
    init_jsonl();
    filePlatforms = [
      jsonlPlatform("oh-my-pi", [homePath(".omp", "agent")], [], (relative, name) => relative.startsWith("sessions/") && name.endsWith(".jsonl")),
      jsonlPlatform("gajae-code", [homePath(".gjc", "agent")], [], (relative, name) => relative.startsWith("sessions/") && name.endsWith(".jsonl")),
      jsonlPlatform(
        "senpi",
        [homePath(".senpi", "agent"), homePath(".pi", "agent")],
        [],
        (relative, name) => relative.startsWith("sessions/") && name.endsWith(".jsonl")
      ),
      jsonlPlatform(
        "openclaw",
        [homePath(".openclaw")],
        [".openclaw"],
        (_relative, name) => name.endsWith(".jsonl")
      ),
      jsonlPlatform("droid", [homePath(".factory")], [".factory"], (relative, name) => {
        const parts = relative.split("/");
        return parts.length === 3 && parts[0] === "sessions" && parts[1] !== "cli" && name.endsWith(".jsonl");
      }),
      jsonPlatform("amp", [homePath(".local", "share", "amp")], ["amp", ".local/share/amp"]),
      jsonlPlatform(
        "qwen",
        [homePath(".qwen")],
        [".qwen"],
        (_relative, name) => name.endsWith(".jsonl")
      ),
      jsonlPlatform(
        "kimi",
        [homePath(".kimi")],
        [".kimi"],
        (relative, name) => relative.includes("/sessions/") && name === "wire.jsonl"
      ),
      jsonPlatform("gemini", [homePath(".gemini")], [".gemini"]),
      jsonPlatform(
        "codebuff",
        [homePath(".config", "codebuff"), homePath(".config", "manicode")],
        ["codebuff", "manicode"]
      ),
      jsonPlatform(
        "roo-code",
        [
          homePath(
            "Library",
            "Application Support",
            "Code",
            "User",
            "globalStorage",
            "rooveterinaryinc.roo-cline"
          )
        ],
        ["rooveterinaryinc.roo-cline"]
      ),
      jsonPlatform(
        "kilo-code",
        [
          homePath(
            "Library",
            "Application Support",
            "Code",
            "User",
            "globalStorage",
            "kilocode.kilo-code"
          )
        ],
        ["kilocode.kilo-code"]
      ),
      jsonPlatform(
        "cline",
        [
          homePath(
            "Library",
            "Application Support",
            "Code",
            "User",
            "globalStorage",
            "saoudrizwan.claude-dev"
          )
        ],
        ["saoudrizwan.claude-dev"]
      )
    ];
  }
});

// vendor/session-finder-independent/src/scanners/kodu.ts
var kodu_exports = {};
__export(kodu_exports, {
  scanKodu: () => scanKodu
});
import { join as join7 } from "node:path";
import { DatabaseSync as DatabaseSync2 } from "node:sqlite";
function scanKodu(extraRoots, rootsOnly = false) {
  const roots = rootsOnly ? extraRoots.flatMap((root) => [join7(root, "Azad.db"), join7(root, "db", "Azad.db")]) : [
    homePath(
      "Library",
      "Application Support",
      "Code",
      "User",
      "globalStorage",
      "kodu-ai.claude-dev-experimental",
      "db",
      "Azad.db"
    ),
    ...extraRoots.flatMap((root) => [
      join7(root, "Azad.db"),
      join7(root, "db", "Azad.db"),
      join7(root, "kodu-ai.claude-dev-experimental", "db", "Azad.db")
    ])
  ];
  return recent(existing(roots)).flatMap(koduDb);
}
function koduDb(path) {
  try {
    const db = new DatabaseSync2(path, { readOnly: true });
    try {
      const tasks = db.prepare(
        "select id, name, dir_absolute_path, created_at, updated_at, tokens_in, tokens_out, cache_reads, cache_writes, cost from tasks"
      ).all().flatMap(rowFromUnknown3);
      return tasks.map((row) => koduSession(path, db, row));
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      return [];
    }
    throw error;
  }
}
function koduSession(path, db, row) {
  const id = text(row["id"]) ?? "";
  const messages = db.prepare(
    "select role, content, model_id, started_at, finished_at, tokens_in, tokens_out, cache_reads, cache_writes, cost from messages where task_id = ? order by started_at"
  ).all(id).flatMap(rowFromUnknown3);
  let firstUser3 = "";
  let lastUser = "";
  let model = null;
  for (const message of messages) {
    model = model ?? text(message["model_id"]);
    if (text(message["role"]) === "user") {
      const prompt = contentFromMaybeJson(message["content"]);
      firstUser3 ||= prompt;
      lastUser = prompt || lastUser;
    }
  }
  return {
    platform: "kodu",
    id,
    path,
    cwd: text(row["dir_absolute_path"]),
    created_at: unixMillis(numberValue(row["created_at"])),
    updated_at: unixMillis(numberValue(row["updated_at"])) ?? fileTime(path),
    provider: null,
    model,
    first_user_message: firstUser3,
    last_user_message: lastUser,
    usage: {
      input: row["tokens_in"] ?? null,
      output: row["tokens_out"] ?? null,
      cacheRead: row["cache_reads"] ?? null,
      cacheWrite: row["cache_writes"] ?? null,
      cost_total: row["cost"] ?? null
    },
    parent_id: null,
    agent: null
  };
}
function rowFromUnknown3(value) {
  const row = jsonMapFromUnknown(value);
  return row === null ? [] : [row];
}
var init_kodu = __esm({
  "vendor/session-finder-independent/src/scanners/kodu.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
  }
});

// vendor/session-finder-independent/src/scanners/kiro.ts
var kiro_exports = {};
__export(kiro_exports, {
  scanKiro: () => scanKiro
});
import { join as join8 } from "node:path";
function scanKiro(extraRoots, rootsOnly = false) {
  const roots = rootsOnly ? existing(extraRoots) : existing([homePath(".kiro"), ...extraRoots.flatMap((root) => [root, join8(root, ".kiro")])]);
  const paths = roots.flatMap(
    (root) => globFiles(join8(root, "sessions", "cli"), (_relative, name) => name.endsWith(".json"))
  );
  return recent(paths).flatMap(kiroSession);
}
function kiroSession(path) {
  const data = asMap(readJson(path) ?? void 0);
  if (data === null) {
    return [];
  }
  const state = asMap(data["session_state"]);
  const rtsState = asMap(state?.["rts_model_state"]);
  const modelInfo = asMap(rtsState?.["model_info"]);
  const metadata = asMap(state?.["conversation_metadata"]);
  const turns = metadata?.["user_turn_metadatas"];
  const [firstUser3, lastUser, created] = promptEdges(path.replace(/\.json$/u, ".jsonl"));
  if (firstUser3 === "") {
    return [];
  }
  return [
    {
      platform: "kiro",
      id: text(data["session_id"]) ?? text(data["sessionId"]) ?? path.split("/").at(-1) ?? path,
      path,
      cwd: text(data["cwd"]),
      created_at: created ?? fileTime(path),
      updated_at: fileTime(path),
      provider: "amazon-bedrock",
      model: text(modelInfo?.["model_id"]),
      first_user_message: firstUser3,
      last_user_message: lastUser,
      usage: Array.isArray(turns) ? { turn_count: turns.length } : {},
      parent_id: null,
      agent: null
    }
  ];
}
function promptEdges(path) {
  let firstUser3 = "";
  let lastUser = "";
  let created = null;
  for (const row of readJsonl(path)) {
    if (row["kind"] !== "Prompt") {
      continue;
    }
    const data = asMap(row["data"]) ?? {};
    const prompt = kiroContent(data["content"]);
    if (prompt !== "") {
      firstUser3 ||= prompt;
      lastUser = prompt;
    }
    const meta = asMap(data["meta"]);
    const stamp = meta?.["timestamp"];
    if (created === null && typeof stamp === "number") {
      created = unixSeconds(stamp);
    }
  }
  return [firstUser3, lastUser, created];
}
function kiroContent(value) {
  if (!Array.isArray(value)) {
    return contentFromMaybeJson(value);
  }
  return value.flatMap((item) => {
    const part = kiroContentPart(item);
    return part === "" ? [] : [part];
  }).join("\n");
}
function kiroContentPart(value) {
  const item = asMap(value);
  if (item === null) {
    return "";
  }
  const kind = text(item["kind"]);
  return kind !== null && kind !== "text" ? "" : text(item["data"]) ?? text(item["text"]) ?? text(item["content"]) ?? "";
}
var init_kiro = __esm({
  "vendor/session-finder-independent/src/scanners/kiro.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
  }
});

// vendor/session-finder-independent/src/scanners/sqlite.ts
var sqlite_exports = {};
__export(sqlite_exports, {
  scanSqlitePlatform: () => scanSqlitePlatform,
  sqlitePlatforms: () => sqlitePlatforms
});
import { join as join9 } from "node:path";
import { DatabaseSync as DatabaseSync3 } from "node:sqlite";
function scanSqlitePlatform(platform, roots, rootsOnly) {
  return recent(existing(platform.paths(roots, rootsOnly))).flatMap(platform.reader);
}
function tablePlatform(platform, table, paths) {
  return {
    platform,
    paths,
    reader: (path) => messageTable(path, platform, table)
  };
}
function messageTable(path, platform, table) {
  try {
    const db = new DatabaseSync3(path, { readOnly: true });
    try {
      const rows2 = db.prepare(`select session_id, role, data, created_at from ${table} order by created_at`).all().flatMap(rowFromUnknown4);
      return grouped(path, platform, rows2);
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      return [];
    }
    throw error;
  }
}
function grouped(path, platform, rows2) {
  const groups = /* @__PURE__ */ new Map();
  for (const row of rows2) {
    const id = text(row["session_id"]);
    if (id === null) continue;
    const message = messageJson(row);
    groups.set(id, [...groups.get(id) ?? [], message]);
  }
  return [...groups.entries()].flatMap(([id, messages]) => {
    const prompt = firstUser2(messages);
    return prompt === "" ? [] : [basic(platform, id, path, prompt, { message_count: messages.length })];
  });
}
function cursorDb(path) {
  try {
    const db = new DatabaseSync3(path, { readOnly: true });
    try {
      const rows2 = db.prepare("select data from blobs").all().flatMap(rowFromUnknown4);
      const prompt = firstUser2(rows2);
      return prompt === "" ? [] : [
        basic("cursor-cli", path.split("/").at(-2) ?? path, path, prompt, {
          blob_count: rows2.length
        })
      ];
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      return [];
    }
    throw error;
  }
}
function zedDb(path) {
  try {
    const db = new DatabaseSync3(path, { readOnly: true });
    try {
      const rows2 = db.prepare("select id, data, updated_at from threads").all().flatMap(rowFromUnknown4);
      return rows2.flatMap((row) => {
        const messages = messageArray2(jsonMapFromUnknown(row["data"]));
        const prompt = firstUser2(messages);
        return prompt === "" ? [] : [
          basic("zed", text(row["id"]) ?? path, path, prompt, {
            message_count: messages.length
          })
        ];
      });
    } finally {
      db.close();
    }
  } catch (error) {
    if (error instanceof Error) {
      return [];
    }
    throw error;
  }
}
function messageJson(row) {
  const parsed = jsonMapFromUnknown(row["data"]);
  return parsed ?? { role: text(row["role"]) ?? "", content: text(row["data"]) ?? "" };
}
function messageArray2(map) {
  const value = map?.["messages"] ?? map?.["turns"] ?? map?.["entries"];
  return Array.isArray(value) ? value.flatMap(rowFromUnknown4) : [];
}
function firstUser2(messages) {
  for (const message of messages) {
    if (text(message["role"]) === "user") {
      const prompt = contentFromMaybeJson(message["content"] ?? message["parts"] ?? message["text"]);
      if (prompt !== "") return prompt;
    }
  }
  return "";
}
function basic(platform, id, path, prompt, usage3) {
  return {
    platform,
    id,
    path,
    cwd: null,
    created_at: fileTime(path),
    updated_at: fileTime(path) ?? unixMillis(null),
    provider: null,
    model: null,
    first_user_message: prompt,
    last_user_message: prompt,
    usage: usage3,
    parent_id: null,
    agent: null
  };
}
function rowFromUnknown4(value) {
  const row = jsonMapFromUnknown(value);
  return row === null ? [] : [row];
}
var sqlitePlatforms;
var init_sqlite = __esm({
  "vendor/session-finder-independent/src/scanners/sqlite.ts"() {
    init_content();
    init_fs();
    init_json();
    init_time();
    sqlitePlatforms = [
      tablePlatform(
        "kilo-cli",
        "message",
        (roots, only) => only ? roots.map((root) => join9(root, "kilo.db")) : [
          homePath(".local", "share", "kilo", "kilo.db"),
          ...roots.map((root) => join9(root, "kilo.db"))
        ]
      ),
      tablePlatform(
        "hermes",
        "messages",
        (roots, only) => only ? roots.map((root) => join9(root, "state.db")) : [homePath(".hermes", "state.db"), ...roots.map((root) => join9(root, "state.db"))]
      ),
      tablePlatform(
        "goose",
        "messages",
        (roots, only) => only ? roots.map((root) => join9(root, "sessions.db")) : [
          homePath(".local", "share", "goose", "sessions", "sessions.db"),
          homePath("Library", "Application Support", "goose", "sessions", "sessions.db"),
          ...roots.map((root) => join9(root, "sessions.db"))
        ]
      ),
      tablePlatform(
        "crush",
        "messages",
        (roots, only) => only ? roots.map((root) => join9(root, "crush.db")) : [
          homePath(".local", "share", "crush", "crush.db"),
          ...roots.map((root) => join9(root, "crush.db"))
        ]
      ),
      {
        platform: "cursor-cli",
        paths: (roots, only) => only ? roots.flatMap((root) => globFiles(root, (_relative, name) => name === "store.db")) : [homePath(".cursor"), ...roots].flatMap(
          (root) => globFiles(join9(root, "chats"), (_relative, name) => name === "store.db")
        ),
        reader: cursorDb
      },
      {
        platform: "zed",
        paths: (roots, only) => only ? roots.map((root) => join9(root, "threads.db")) : [
          homePath("Library", "Application Support", "Zed", "threads", "threads.db"),
          ...roots.map((root) => join9(root, "threads.db"))
        ],
        reader: zedDb
      }
    ];
  }
});

// vendor/session-finder-independent/src/arg-parser.ts
import { cpus } from "node:os";

// vendor/session-finder-independent/src/scanners/index.ts
var platformAliases = {
  asidehq: "aside",
  cursor: "cursor-cli",
  factory: "droid",
  roo: "roo-code",
  roocode: "roo-code",
  kilocode: "kilo-code",
  kilo: "kilo-cli"
};
var aliasMap = new Map(Object.entries(platformAliases));
var filePlatformNames = [
  "oh-my-pi",
  "gajae-code",
  "senpi",
  "openclaw",
  "droid",
  "amp",
  "qwen",
  "kimi",
  "gemini",
  "codebuff",
  "roo-code",
  "kilo-code",
  "cline"
];
var sqlitePlatformNames = ["kilo-cli", "hermes", "goose", "crush", "cursor-cli", "zed"];
var filePlatformNameSet = new Set(filePlatformNames);
var sqlitePlatformNameSet = new Set(sqlitePlatformNames);
var scannerCache = /* @__PURE__ */ new Map();
var defaultPlatforms = /* @__PURE__ */ new Set([
  "codex",
  "claude",
  "aside",
  "opencode",
  "aider",
  "kodu",
  "kiro",
  ...filePlatformNames,
  ...sqlitePlatformNames
]);
async function scan(request) {
  const selected = new Set([...request.platforms].map((platform) => normalizePlatform(platform)));
  const tasks = [...selected].map(async (platform) => {
    const scanner = await scannerFor(platform);
    return scanner === null ? [] : scanner(request.roots, request.workers, request.rootsOnly ?? false);
  });
  const groups = await Promise.all(tasks);
  return dedupe(groups.flat());
}
function normalizePlatform(platform) {
  const key = platform.toLowerCase();
  return aliasMap.get(key) ?? key;
}
function dedupe(sessions) {
  const found = /* @__PURE__ */ new Map();
  for (const session of sessions) {
    const key = `${session.platform}\0${session.id}`;
    const current = found.get(key);
    if (current === void 0 || linkageScore(session) > linkageScore(current)) {
      found.set(key, session);
    }
  }
  return [...found.values()];
}
function linkageScore(session) {
  return (session.parent_id === null ? 0 : 1) + (session.agent === null ? 0 : 1);
}
async function scannerFor(platform) {
  const cached = scannerCache.get(platform);
  if (cached !== void 0) {
    return cached;
  }
  const scanner = loadScanner(platform);
  scannerCache.set(platform, scanner);
  return scanner;
}
async function loadScanner(platform) {
  switch (platform) {
    case "codex": {
      const { scanCodex: scanCodex2 } = await Promise.resolve().then(() => (init_codex(), codex_exports));
      return (roots, _workers, rootsOnly) => scanCodex2(roots, rootsOnly);
    }
    case "claude": {
      const { scanClaude: scanClaude2 } = await Promise.resolve().then(() => (init_claude(), claude_exports));
      return (roots, _workers, rootsOnly) => scanClaude2(roots, rootsOnly);
    }
    case "aside": {
      const { scanAside: scanAside2 } = await Promise.resolve().then(() => (init_aside(), aside_exports));
      return (roots, _workers, rootsOnly) => scanAside2(roots, rootsOnly);
    }
    case "opencode": {
      const { scanOpenCode: scanOpenCode2 } = await Promise.resolve().then(() => (init_opencode(), opencode_exports));
      return (roots, _workers, rootsOnly) => scanOpenCode2(roots, rootsOnly);
    }
    case "aider": {
      const { scanAider: scanAider2 } = await Promise.resolve().then(() => (init_generic(), generic_exports));
      return (roots) => scanAider2(roots);
    }
    case "kodu": {
      const { scanKodu: scanKodu2 } = await Promise.resolve().then(() => (init_kodu(), kodu_exports));
      return (roots, _workers, rootsOnly) => scanKodu2(roots, rootsOnly);
    }
    case "kiro": {
      const { scanKiro: scanKiro2 } = await Promise.resolve().then(() => (init_kiro(), kiro_exports));
      return (roots, _workers, rootsOnly) => scanKiro2(roots, rootsOnly);
    }
    default:
      return isFilePlatformName(platform) ? fileScannerFor(platform) : isSqlitePlatformName(platform) ? sqliteScannerFor(platform) : null;
  }
}
function isFilePlatformName(platform) {
  return filePlatformNameSet.has(platform);
}
function isSqlitePlatformName(platform) {
  return sqlitePlatformNameSet.has(platform);
}
async function fileScannerFor(platform) {
  const { filePlatforms: filePlatforms2, scanFilePlatform: scanFilePlatform2 } = await Promise.resolve().then(() => (init_generic(), generic_exports));
  const config = filePlatforms2.find((item) => item.platform === platform);
  return config === void 0 ? () => [] : (roots, _workers, rootsOnly) => scanFilePlatform2(config, roots, rootsOnly);
}
async function sqliteScannerFor(platform) {
  const { scanSqlitePlatform: scanSqlitePlatform2, sqlitePlatforms: sqlitePlatforms2 } = await Promise.resolve().then(() => (init_sqlite(), sqlite_exports));
  const config = sqlitePlatforms2.find((item) => item.platform === platform);
  return config === void 0 ? () => [] : (roots, _workers, rootsOnly) => scanSqlitePlatform2(config, roots, rootsOnly);
}

// vendor/session-finder-independent/src/arg-parser.ts
var CliError = class extends Error {
  name = "CliError";
};
function parseArgs(args) {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return { command: "help", options: baseOptions(), rest: [] };
  }
  const raw = args[0];
  const command = raw === "find" ? "search" : raw === "read" ? "get" : raw;
  if (command !== "list" && command !== "search" && command !== "get") {
    throw new CliError(`unknown command: ${raw ?? ""}`);
  }
  return readOptions(command, args);
}
function readOptions(command, args) {
  const rest = [];
  const queries = [];
  const roots = [];
  const platforms = [];
  const cwd = [];
  const eventQueries = [];
  let dateFrom = null;
  let dateTo = null;
  let model = null;
  let limit = 20;
  let workers = defaultWorkers();
  let excerptChars = 240;
  let includeSubagents = false;
  for (let index = 1; index < args.length; ) {
    const next = parseOption(args, index, { queries, roots, platforms });
    if (next !== null) {
      index = next;
      continue;
    }
    const arg = args[index];
    switch (arg) {
      case "--from":
        dateFrom = requiredValue(args, index);
        index += 2;
        break;
      case "--to":
        dateTo = requiredValue(args, index);
        index += 2;
        break;
      case "--cwd":
        cwd.push(requiredValue(args, index).toLowerCase());
        index += 2;
        break;
      case "--grep":
        eventQueries.push(requiredValue(args, index));
        index += 2;
        break;
      case "--model":
        model = requiredValue(args, index).toLowerCase();
        index += 2;
        break;
      case "--excerpt-chars":
        excerptChars = readPositiveInteger(args, index);
        index += 2;
        break;
      case "--limit":
        limit = readPositiveInteger(args, index);
        index += 2;
        break;
      case "--workers":
        workers = readPositiveInteger(args, index);
        index += 2;
        break;
      case "--include-subagents":
        includeSubagents = true;
        index += 1;
        break;
      default:
        rest.push(arg ?? "");
        index += 1;
    }
  }
  return {
    command,
    options: {
      platforms: platforms.length === 0 ? defaultPlatforms : new Set(platforms),
      roots,
      queries,
      dateFrom,
      dateTo,
      cwd,
      model,
      limit,
      workers,
      includeSubagents,
      eventQueries,
      excerptChars
    },
    rest
  };
}
function parseOption(args, index, target) {
  const arg = args[index];
  if (arg === "--root") {
    target.roots.push(requiredValue(args, index));
    return index + 2;
  }
  if (arg === "--query") {
    target.queries.push(requiredValue(args, index));
    return index + 2;
  }
  if (arg === "--platform") {
    const platform = requiredValue(args, index).trim().toLowerCase();
    if (platform.includes(",")) {
      throw new CliError(
        "Use repeated --platform flags, for example: --platform senpi --platform opencode"
      );
    }
    target.platforms.push(platform);
    return index + 2;
  }
  return null;
}
function baseOptions() {
  return {
    platforms: defaultPlatforms,
    roots: [],
    queries: [],
    dateFrom: null,
    dateTo: null,
    cwd: [],
    model: null,
    limit: 20,
    workers: defaultWorkers(),
    includeSubagents: false,
    eventQueries: [],
    excerptChars: 240
  };
}
function requiredValue(args, index) {
  const value = args[index + 1];
  if (value === void 0) {
    throw new CliError(`missing value for ${args[index] ?? "flag"}`);
  }
  return value;
}
function readPositiveInteger(args, index) {
  const flag = args[index] ?? "flag";
  const value = requiredValue(args, index);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new CliError(`${flag} must be a positive integer`);
  }
  return Number.parseInt(value, 10);
}
function defaultWorkers() {
  return Math.min(Math.max(cpus().length * 4, 8), 64);
}

// vendor/session-finder-independent/src/payloads.ts
init_content();
init_event_text();
init_json();
import { readFileSync as readFileSync4 } from "node:fs";
var defaultReadOptions = { eventQueries: [], excerptChars: 240 };
function listPayload(filtered, allSessions, limit, includeSubagents) {
  const counts = childCounts(allSessions);
  const candidates = includeSubagents ? filtered : filtered.filter((item) => item.parent_id === null);
  return {
    count: Math.min(candidates.length, limit),
    results: candidates.slice(0, limit).map((item) => annotate(item, counts))
  };
}
function searchPayload(filtered, allSessions, queries, limit, includeSubagents) {
  const counts = childCounts(allSessions);
  const candidates = includeSubagents ? filtered : filtered.filter((item) => item.parent_id === null);
  const perQuery = queries.map((query) => {
    const matches = [];
    for (const item of candidates) {
      const reasons = matchReasons(item, query);
      if (reasons.length === 0) {
        continue;
      }
      matches.push({ item, reasons });
      if (matches.length >= limit) {
        break;
      }
    }
    return {
      query,
      count: matches.length,
      results: matches.map(({ item, reasons }) => annotateSearch(item, counts, reasons))
    };
  });
  const merged = /* @__PURE__ */ new Map();
  for (const group of perQuery) {
    for (const item of group.results) {
      const key = `${item.platform}\0${item.id}`;
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    }
  }
  return {
    count: Math.min(merged.size, limit),
    queries: perQuery,
    results: [...merged.values()].slice(0, limit)
  };
}
function getPayload(sessions, ids, opts = defaultReadOptions) {
  const counts = childCounts(sessions);
  const results = sessions.filter((item) => ids.includes(item.id) || ids.some((id) => item.id.startsWith(id))).map((item) => {
    const events = eventsFor(item);
    const matches = matchedEvents(events, opts);
    const prompts = promptEdges2(item, events);
    const children = sessions.filter((child) => child.platform === item.platform && child.parent_id === item.id).sort((left, right) => (left.created_at ?? "").localeCompare(right.created_at ?? ""));
    return {
      session: annotate(
        {
          ...item,
          first_user_message: prompts.first_user_message,
          last_user_message: prompts.last_user_message
        },
        counts
      ),
      prompts,
      events: opts.eventQueries.length === 0 ? events : [],
      matched_events: matches,
      subagents: children.map((child) => annotate(child, counts)),
      detail_hint: detailHint(item)
    };
  });
  return { count: results.length, results };
}
function annotate(item, counts) {
  const json = toSessionJson(item);
  return {
    platform: item.platform,
    id: item.id,
    path: item.path,
    cwd: item.cwd,
    created_at: item.created_at,
    updated_at: item.updated_at,
    provider: item.provider,
    model: item.model,
    first_user_message: typeof json["first_user_message"] === "string" ? json["first_user_message"] : item.first_user_message,
    last_user_message: typeof json["last_user_message"] === "string" ? json["last_user_message"] : item.last_user_message,
    usage: item.usage,
    parent_id: item.parent_id,
    agent: item.agent,
    subagent_count: counts.get(`${item.platform}\0${item.id}`) ?? 0,
    detail_hint: detailHint(item)
  };
}
function annotateSearch(item, counts, reasons) {
  return { ...annotate(item, counts), match_reasons: reasons };
}
function childCounts(sessions) {
  const counts = /* @__PURE__ */ new Map();
  for (const item of sessions) {
    if (item.parent_id !== null) {
      const key = `${item.platform}\0${item.parent_id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}
function detailHint(item) {
  const quote = (value) => /^[A-Za-z0-9_.-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'";
  const command = process.env["SCRUM_SESSION_FINDER_COMMAND"] ?? "coding-agent-sessions";
  return `${command} read ${quote(item.id)} --platform ${quote(item.platform)}`;
}
function matchReasons(item, query) {
  const needle = query.toLowerCase();
  const fieldReasons = searchFields(item).flatMap(
    ([field, value]) => value.toLowerCase().includes(needle) ? [{ query, platform: item.platform, field, snippet: snippet(value, needle) }] : []
  );
  if (fieldReasons.length > 0) {
    return fieldReasons;
  }
  if (item.event_search_text !== void 0 && (item.event_search_text_lower ?? item.event_search_text.toLowerCase()).includes(needle)) {
    return [
      {
        query,
        platform: item.platform,
        field: "event",
        snippet: snippet(item.event_search_text, needle)
      }
    ];
  }
  if (item.event_search_indexed === true) {
    return [];
  }
  return item.path.endsWith(".jsonl") && fileContainsNeedle(item.path, needle) ? eventMatchReasons(item, eventsFor(item), query, needle) : [];
}
function searchFields(item) {
  return [
    ["platform", item.platform],
    ["id", item.id],
    ["path", item.path],
    ["cwd", item.cwd ?? ""],
    ["provider", item.provider ?? ""],
    ["model", item.model ?? ""],
    ["agent", item.agent ?? ""],
    ["first_user_message", item.first_user_message],
    ["last_user_message", item.last_user_message]
  ];
}
function eventsFor(item) {
  if (item.path.endsWith(".jsonl")) {
    return readJsonl(item.path);
  }
  return [{ type: "message", message: { role: "user", content: item.first_user_message } }];
}
function fileContainsNeedle(path, needle) {
  try {
    return readFileSync4(path, "utf8").toLowerCase().includes(needle);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      return false;
    }
    throw error;
  }
}
function promptEdges2(item, events) {
  let firstPrompt = item.first_user_message;
  let lastPrompt = item.last_user_message || item.first_user_message;
  for (const event of events) {
    const map = asMap(event);
    const payload = asMap(map?.["payload"]);
    const message = asMap(map?.["message"]) ?? (payload?.["role"] === "user" ? payload : null) ?? {};
    const prompt = map === null ? "" : userText(map, message);
    const fallback = payload?.["role"] === "user" ? contentText(payload["content"]) : "";
    const value = prompt || fallback;
    if (value !== "") {
      firstPrompt ||= value;
      lastPrompt = value;
    }
  }
  return { first_user_message: firstPrompt, last_user_message: lastPrompt };
}

// vendor/session-finder-independent/src/cli.ts
init_time();
async function run(args) {
  const parsed = parseArgs(args);
  if (parsed.command === "help") {
    usage2();
    return 0;
  }
  const searchQueries = parsed.command === "search" ? parsed.options.queries.length > 0 ? parsed.options.queries : [parsed.rest.join(" ").trim()].filter((query) => query !== "") : [];
  if (parsed.command === "search") {
    requireValues(searchQueries, "search requires a query");
  }
  if (parsed.command === "get") {
    requireValues(parsed.rest, "read requires at least one session id");
  }
  const sessions = [
    ...await scan({
      platforms: parsed.options.platforms,
      roots: parsed.options.roots,
      workers: parsed.options.workers
    })
  ].sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""));
  const filtered = filterSessions(sessions, parsed.options);
  if (parsed.command === "list") {
    emit(listPayload(filtered, sessions, parsed.options.limit, parsed.options.includeSubagents));
    return 0;
  }
  if (parsed.command === "search") {
    emit(
      searchPayload(
        filtered,
        sessions,
        searchQueries,
        parsed.options.limit,
        parsed.options.includeSubagents
      )
    );
    return 0;
  }
  emit(
    getPayload(sessions, parsed.rest, {
      eventQueries: parsed.options.eventQueries,
      excerptChars: parsed.options.excerptChars
    })
  );
  return 0;
}
function filterSessions(sessions, opts) {
  const start = dateBound(opts.dateFrom);
  const end = dateBound(opts.dateTo, true);
  return sessions.filter((item) => {
    const stamp = parseStamp(item.created_at);
    if (start !== null && stamp !== null && stamp < start) return false;
    if (end !== null && stamp !== null && stamp >= end) return false;
    if (opts.cwd.length > 0 && !opts.cwd.some((cwd) => (item.cwd ?? "").toLowerCase().includes(cwd))) {
      return false;
    }
    if (opts.model !== null && !(item.model ?? "").toLowerCase().includes(opts.model)) return false;
    return true;
  });
}
function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
function requireValues(values, message) {
  if (values.length === 0) {
    throw new CliError(message);
  }
}
function usage2() {
  process.stdout.write(
    "Usage: coding-agent-sessions list|find|search|read|get [query|ids...] [--query TEXT ...] [--platform NAME ...] [--root PATH] [--from DATE] [--to DATE] [--cwd TEXT ...] [--model TEXT] [--limit N] [--workers N] [--include-subagents] [--grep TEXT ...] [--excerpt-chars N]\n"
  );
}
if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((error) => {
    if (error instanceof CliError) {
      process.stderr.write(`${error.message}
`);
      process.exit(1);
    }
    throw error;
  });
}
export {
  getPayload,
  listPayload,
  parseArgs,
  run,
  searchPayload
};

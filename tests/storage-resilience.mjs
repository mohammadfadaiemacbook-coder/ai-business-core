import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("function save(){");
const end = app.indexOf("\nasync function initializeCloudSync()", start);
assert.ok(start >= 0 && end > start, "save() function must be present");
const saveSource = app.slice(start, end);

function loadSave({ failLocal = false, token = "test-workspace-token", conflict = false } = {}) {
  const calls = { localWrites: 0, cloudSchedules: 0, messages: [], warnings: 0 };
  const sandbox = {
    KEY: "workspace-state",
    state: { tasks: [{ id: "task-1" }] },
    cloudToken: token,
    cloudConflict: conflict,
    localStorage: {
      setItem() {
        calls.localWrites++;
        if (failLocal) throw new Error("QuotaExceededError");
      },
    },
    scheduleCloudSave() { calls.cloudSchedules++; },
    toast(message) { calls.messages.push(message); },
    console: { warn() { calls.warnings++; } },
  };
  runInNewContext(saveSource + "\nglobalThis.runSave = save;", sandbox);
  return { run: sandbox.runSave, calls };
}

test("cloud sync is still scheduled when the localStorage write fails", () => {
  const { run, calls } = loadSave({ failLocal: true });
  assert.equal(run(), false);
  assert.equal(calls.localWrites, 1);
  assert.equal(calls.cloudSchedules, 1);
  assert.equal(calls.warnings, 1);
  assert.match(calls.messages[0], /همگام‌سازی ابری برای تلاش زمان‌بندی شد/);
});

test("a cloud conflict is not reported as a successful sync attempt after local failure", () => {
  const { run, calls } = loadSave({ failLocal: true, conflict: true });
  assert.equal(run(), false);
  assert.equal(calls.cloudSchedules, 1);
  assert.match(calls.messages[0], /به‌دلیل تعارض متوقف است/);
});

test("successful localStorage writes still schedule cloud sync and return true", () => {
  const { run, calls } = loadSave();
  assert.equal(run(), true);
  assert.equal(calls.localWrites, 1);
  assert.equal(calls.cloudSchedules, 1);
  assert.equal(calls.messages.length, 0);
});

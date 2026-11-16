import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("const KEY=");
const end = app.indexOf("\nlet view=", start);
assert.ok(start >= 0 && end > start, "app bootstrap block must be present");
const bootstrap = app.slice(start, end);

test("app bootstrap survives blocked localStorage and sessionStorage accessors", () => {
  const sandbox = {};
  Object.defineProperty(sandbox, "localStorage", {
    get() { throw new Error("SecurityError: storage is blocked"); },
  });
  Object.defineProperty(sandbox, "sessionStorage", {
    get() { throw new Error("SecurityError: storage is blocked"); },
  });
  runInNewContext(
    bootstrap + "\nglobalThis.__result = { LOCAL_DATA_PRESENT, state, safeLocalGet, safeSessionGet };",
    sandbox,
  );
  assert.equal(sandbox.__result.LOCAL_DATA_PRESENT, false);
  assert.deepEqual(Array.from(sandbox.__result.state.tasks), []);
  assert.equal(sandbox.__result.safeLocalGet("workspace"), null);
  assert.equal(sandbox.__result.safeSessionGet("token"), null);
});

test("app bootstrap survives storage methods that throw", () => {
  const blocked = { getItem() { throw new Error("SecurityError"); } };
  const sandbox = { localStorage: blocked, sessionStorage: blocked };
  runInNewContext(
    bootstrap + "\nglobalThis.__result = { LOCAL_DATA_PRESENT, state, safeLocalGet, safeSessionGet };",
    sandbox,
  );
  assert.equal(sandbox.__result.LOCAL_DATA_PRESENT, false);
  assert.equal(sandbox.__result.safeLocalGet("workspace"), null);
  assert.equal(sandbox.__result.safeSessionGet("token"), null);
});

test("all application storage reads are routed through guarded helpers", () => {
  assert.equal((app.match(/localStorage\\.getItem\\(/g) || []).length, 1);
  assert.equal((app.match(/sessionStorage\\.getItem\\(/g) || []).length, 1);
  assert.match(app, /function safeLocalGet\\(key\\)/);
  assert.match(app, /function safeSessionGet\\(key\\)/);
});

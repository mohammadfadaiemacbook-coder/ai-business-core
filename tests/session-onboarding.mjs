import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
test("saved sessions refresh the visible dashboard after cloud restoration", () => {
  const start = app.indexOf("async function initializeCloudSync()");
  const end = app.indexOf("async function persistYoutubeDraftToCloud", start);
  const init = app.slice(start, end);
  assert.ok(init.includes("cloudToken=remembered"));
  assert.ok(init.includes("render();"));
});

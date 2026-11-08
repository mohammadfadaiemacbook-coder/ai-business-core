import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const deploy = readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

test("application shell exposes the primary navigation and mobile controls", () => {
  for (const id of ["app-sidebar", "sidebar-backdrop", "breadcrumb-current", "view-root"]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const view of ["overview", "ai", "youtube", "instagram", "website", "tasks", "research", "content", "calendar", "approvals", "settings"]) {
    assert.ok(html.includes(`data-view="${view}"`), `missing navigation for ${view}`);
  }
  assert.ok(html.includes('data-action="toggle-menu"'));
  assert.ok(html.includes('data-action="close-menu"'));
});

test("first-run dashboard exposes secure token and workspace onboarding", () => {
  assert.match(app, /function overview\(\)[\s\S]*?id="cloud-token"/);
  assert.match(app, /id="cloud-workspace"/);
  assert.match(app, /data-action="cloud-connect"/);
  assert.match(app, /sessionStorage\.setItem\(CLOUD_TOKEN_KEY,token\)/);
  assert.match(app, /function cloudWorkspaceId\(\)[\s\S]*?ai-business-core-workspace-v1/);
});

test("GitHub Pages publishes automatically after a successful main update", () => {
  assert.match(deploy, /push:[\s\S]*?branches:\s*\[main\]/);
  assert.match(deploy, /github\.event_name == 'push' \|\| inputs\.confirm_publish == 'PUBLISH'/);
  assert.match(deploy, /actions\/deploy-pages@v4/);
});

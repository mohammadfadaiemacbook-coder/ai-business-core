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
  for (const view of ["overview", "ai", "youtube", "tasks", "research", "content", "calendar", "approvals", "settings"]) {
    assert.ok(html.includes(`data-view="${view}"`), `missing navigation for ${view}`);
  }
  for (const unfinished of ["instagram", "website"]) assert.ok(!html.includes(`data-view="${unfinished}"`), `unfinished ${unfinished} module should be hidden`);
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

test("GitHub Pages deployment requires explicit manual confirmation and never runs on push", () => {
  assert.match(deploy, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(deploy, /^\s+push:/m);
  assert.match(deploy, /if: github\.event_name == 'workflow_dispatch' && inputs\.confirm_publish == 'PUBLISH'/);
  assert.match(deploy, /default: NO/);
  assert.match(deploy, /actions\/deploy-pages@v4/);
});

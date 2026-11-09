import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

test("GitHub Pages deployment requires explicit manual confirmation and never deploys on push", () => {
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && inputs\.confirm_publish == 'PUBLISH'/);
  assert.match(workflow, /default: NO/);
  assert.match(workflow, /- PUBLISH/);
});

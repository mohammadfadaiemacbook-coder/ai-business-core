import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("Oddling GLB import requires the exact 25 unique expected model files", () => {
  assert.match(app, /expectedById=new Map\(ODDLINGS\.map/);
  assert.match(app, /expected\.file\.toLowerCase\(\)!==leaf\.toLowerCase\(\)/);
  assert.match(app, /seen\.has\(id\)/);
  assert.match(app, /seen\.size!==25/);
  assert.match(app, /ODDLINGS\.some\(x=>!seen\.has\(x\.id\)\)/);
});

test("Oddling GLB import validates GLB v2 header and declared byte length", () => {
  assert.match(app, /0x46546c67/);
  assert.match(app, /glb\.getUint32\(4,true\)!==2/);
  assert.match(app, /glb\.getUint32\(8,true\)!==data\.byteLength/);
});

test("imported 3D model replaces the static portrait in the selected-character view", () => {
  assert.match(app, /viewer\.hidden=false;if\(big\)big\.hidden=true/);
  assert.match(app, /if\(big\)\{big\.hidden=false;drawOddlingPortrait/);
});

test("ZIP import limits compressed and expanded content before IndexedDB writes", () => {
  assert.match(app, /file\.size>150\*1024\*1024/);
  assert.match(app, /totalExpanded>300\*1024\*1024/);
  assert.match(app, /await saveOddlingModels\(rows\)/);
});

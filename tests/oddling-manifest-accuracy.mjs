import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const directory = new URL("../public/characters/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
const files = await readdir(directory);
const docs = await readFile(new URL("../docs/free-mobile-youtube-engine.md", import.meta.url), "utf8");

test("the 25 Oddling manifest describes metadata and 2D PNG portraits, not shipped GLB models", () => {
  assert.equal(manifest.characters.length, 25);
  assert.equal(new Set(manifest.characters.map(character => character.name)).size, 25);
  assert.equal(manifest.format, "metadata-only JSON; no GLB binary assets are included");
  assert.ok(manifest.modelNote.includes("No actual GLB model assets are currently included"));
  assert.ok(manifest.assetStatus.includes("no GLB files are present"));
  assert.ok(manifest.portraitRendering.includes("2D Canvas PNGs"));
  assert.equal(files.some(file => file.toLowerCase().endsWith(".glb")), false);
});

test("character documentation distinguishes the downloadable 25-PNG ZIP from GLB import support", () => {
  assert.ok(docs.includes("25 procedurally generated 2D PNG portraits"));
  assert.ok(docs.includes("not a GLB or 3D character pack"));
  assert.ok(docs.includes("does **not** contain the referenced GLB binaries"));
  assert.ok(docs.includes("user-provided ZIP containing GLB models"));
  assert.equal(docs.includes("AI_Business_Core_25_3D_Characters.zip"), false);
  assert.ok(docs.includes("No GLB source meshes are included in this repository"));
});

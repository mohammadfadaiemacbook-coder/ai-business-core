import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../public/characters/manifest.json", import.meta.url), "utf8"));
const start = app.indexOf("function validateOddlingGlb(data,name){");
const end = app.indexOf("\nconst ODDLING_TRAITS=", start);
assert.ok(start >= 0 && end > start, "importer source must exist");
const importerSource = app.slice(start, end);

function crc32(bytes) {
  let c = -1;
  for (const byte of bytes) {
    c ^= byte;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ -1) >>> 0;
}
function makeGlb(rigged = true) {
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: rigged ? [{ mesh: 0, skin: 0 }, {}, {}] : [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: rigged ? { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } : { POSITION: 0 } }] }],
    skins: rigged ? [{ joints: [1, 2] }] : [],
    animations: rigged ? [{ channels: [{ sampler: 0, target: { node: 1, path: "rotation" } }], samplers: [{ input: 3, output: 4 }] }] : []
  };
  const json = Buffer.from(JSON.stringify(document));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const padded = Buffer.alloc(paddedLength, 0x20);
  json.copy(padded);
  const out = Buffer.alloc(20 + paddedLength);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(paddedLength, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(out, 20);
  return out;
}
function makeZip(files) {
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.bytes);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  const blob = new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  Object.defineProperty(blob, "name", { value: "oddling-pack.zip" });
  return blob;
}
function makeManifest(overrides = {}) {
  return {
    pack: "The 25 Oddlings",
    format: "glTF 2.0 binary (.glb)",
    assetStatus: "complete",
    modelNote: "25 original rigged and animated GLB models",
    characters: manifest.characters.map(x => ({ id: x.id, name: x.name, file: x.file })),
    ...overrides
  };
}
function makeFiles({ count = 25, rigged = true, manifestOverrides = {}, mutate = null } = {}) {
  const files = manifest.characters.slice(0, count).map(x => ({
    name: "models/" + x.file,
    bytes: makeGlb(rigged)
  }));
  files.push({ name: "manifest.json", bytes: Buffer.from(JSON.stringify(makeManifest(manifestOverrides))) });
  if (mutate) mutate(files);
  return files;
}
async function runImport(files) {
  let saved = null, metadata = null;
  const context = {
    ODDLINGS: manifest.characters.map(x => ({ ...x })),
    crc32,
    DecompressionStream,
    Blob,
    Response,
    TextDecoder,
    Uint8Array,
    DataView,
    saveOddlingModels: async rows => { saved = rows; },
    renderOddlingLibrary: async () => {},
    localStorage: { setItem: (key, value) => { metadata = { key, value }; } },
    toast: () => {}
  };
  const importer = await vm.runInNewContext("(async()=>{" + importerSource + ";return importOddlingZip})()", context);
  try {
    await importer(makeZip(files));
    return { saved, metadata, error: null };
  } catch (error) {
    return { saved, metadata, error: error.message };
  }
}

test("imports exactly 25 unique, rigged and animated GLB 2.0 models only after full validation", async () => {
  const result = await runImport(makeFiles());
  assert.equal(result.error, null);
  assert.equal(result.saved.length, 25);
  assert.equal(new Set(result.saved.map(x => x.id)).size, 25);
  assert.equal(result.metadata.key, "aibc-oddling-pack-installed-v1");
});

test("rejects a missing model without writing any IndexedDB rows", async () => {
  const result = await runImport(makeFiles({ count: 24 }));
  assert.match(result.error, /۲۵|25/);
  assert.equal(result.saved, null);
});

test("rejects an unrigged or unanimated GLB", async () => {
  const result = await runImport(makeFiles({ rigged: false }));
  assert.match(result.error, /اسکلت|انیمیشن/);
  assert.equal(result.saved, null);
});

test("rejects corrupted ZIP data using CRC before saving", async () => {
  const result = await runImport(makeFiles({ mutate: files => { files[0].bytes[25] ^= 0xff; } }));
  assert.match(result.error, /CRC|اندازه/);
  assert.equal(result.saved, null);
});

test("rejects the repository metadata-only manifest instead of accepting planned filenames as assets", async () => {
  const result = await runImport(makeFiles({ manifestOverrides: { assetStatus: "metadata-only; the 25 referenced GLB files are not present" } }));
  assert.match(result.error, /فهرست فایل|مدل‌های واقعی/);
  assert.equal(result.saved, null);
});

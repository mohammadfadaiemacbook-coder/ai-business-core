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
function makeGlb(rigged = true, options = {}) {
  const binary = Buffer.alloc(136);
  const positions = [0,0,0, 1,0,0, 0,1,0];
  positions.forEach((value, i) => binary.writeFloatLE(value, i * 4));
  for (let vertex = 0; vertex < 3; vertex++) {
    binary.set([0,1,0,0], 36 + vertex * 4);
    [0.5,0.5,0,0].forEach((value, i) => binary.writeFloatLE(value, 48 + vertex * 16 + i * 4));
  }
  binary.writeFloatLE(0, 96);
  binary.writeFloatLE(1, 100);
  [0,0,0,1, 0,0,0.3826834,0.9238795].forEach((value, i) => binary.writeFloatLE(value, 104 + i * 4));
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: rigged ? [{ mesh: 0, skin: 0 }, { children: [2] }, {}] : [{ mesh: 0 }, { children: [2] }, {}],
    meshes: [{ primitives: [{ attributes: rigged ? { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } : { POSITION: 0 } }] }],
    skins: rigged ? [{ joints: [1, 2], skeleton: 1 }] : [],
    animations: rigged ? [{ channels: [{ sampler: 0, target: { node: 1, path: "rotation" } }], samplers: [{ input: 3, output: 4, interpolation: "LINEAR" }] }] : [],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 12, target: 34962 },
      { buffer: 0, byteOffset: 48, byteLength: 48, target: 34962 },
      { buffer: 0, byteOffset: 96, byteLength: 8 },
      { buffer: 0, byteOffset: 104, byteLength: 32 }
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0,0,0], max: [1,1,0] },
      { bufferView: 1, componentType: 5121, count: 3, type: "VEC4" },
      { bufferView: 2, componentType: 5126, count: 3, type: "VEC4" },
      { bufferView: 3, componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
      { bufferView: 4, componentType: 5126, count: 2, type: "VEC4" }
    ]
  };
  if (typeof options.mutateJson === "function") options.mutateJson(document);
  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const jsonPadded = Buffer.alloc(jsonLength, 0x20);
  json.copy(jsonPadded);
  const includeBin = options.includeBin !== false;
  const totalLength = 12 + 8 + jsonLength + (includeBin ? 8 + binary.length : 0);
  const out = Buffer.alloc(totalLength);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);
  out.writeUInt32LE(jsonLength, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonPadded.copy(out, 20);
  if (includeBin) {
    const binHeader = 20 + jsonLength;
    out.writeUInt32LE(binary.length, binHeader);
    out.writeUInt32LE(0x004e4942, binHeader + 4);
    binary.copy(out, binHeader + 8);
  }
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
function makeFiles({ count = 25, rigged = true, manifestOverrides = {}, mutate = null, glbOptions = {} } = {}) {
  const files = manifest.characters.slice(0, count).map(x => ({
    name: "models/" + x.file,
    bytes: makeGlb(rigged, glbOptions)
  }));
  files.push({ name: "manifest.json", bytes: Buffer.from(JSON.stringify(makeManifest(manifestOverrides))) });
  if (mutate) mutate(files);
  return files;
}
async function runImportBlob(blob) {
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
    await importer(blob);
    return { saved, metadata, error: null };
  } catch (error) {
    return { saved, metadata, error: error.message };
  }
}

async function runImport(files) { return runImportBlob(makeZip(files)); }

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
  const original = makeZip(makeFiles());
  const bytes = Buffer.from(await original.arrayBuffer());
  const firstNameLength = bytes.readUInt16LE(26);
  const firstExtraLength = bytes.readUInt16LE(28);
  const firstDataStart = 30 + firstNameLength + firstExtraLength;
  bytes[firstDataStart + 25] ^= 0xff;
  const corrupted = new Blob([bytes], { type: "application/zip" });
  Object.defineProperty(corrupted, "name", { value: "oddling-pack.zip" });
  const result = await runImportBlob(corrupted);
  assert.match(result.error, /CRC|اندازه/);
  assert.equal(result.saved, null);
});

test("rejects the repository metadata-only manifest instead of accepting planned filenames as assets", async () => {
  const result = await runImport(makeFiles({ manifestOverrides: { assetStatus: "metadata-only; the 25 referenced GLB files are not present" } }));
  assert.match(result.error, /فهرست فایل|مدل‌های واقعی/);
  assert.equal(result.saved, null);
});
test("rejects a GLB that declares skin metadata but has no embedded BIN chunk", async () => {
  const result = await runImport(makeFiles({ glbOptions: { includeBin: false } }));
  assert.match(result.error, /BIN|باینری|buffer/);
  assert.equal(result.saved, null);
});

test("rejects accessors that point beyond the embedded binary buffer", async () => {
  const result = await runImport(makeFiles({ glbOptions: { mutateJson: json => { json.accessors[1].count = 100; } } }));
  assert.match(result.error, /bufferView|accessor|خارج از محدوده/);
  assert.equal(result.saved, null);
});

test("rejects animation metadata that does not animate a skin joint", async () => {
  const result = await runImport(makeFiles({ glbOptions: { mutateJson: json => { json.animations[0].channels[0].target.node = 0; } } }));
  assert.match(result.error, /مفصل|انیمیشن/);
  assert.equal(result.saved, null);
});

test("rejects vertex weights that do not reference valid skin joints", async () => {
  const result = await runImport(makeFiles({ glbOptions: { mutateJson: json => { json.skins[0].joints = [1]; } } }));
  assert.match(result.error, /مفصل|joint|اسکلت/);
  assert.equal(result.saved, null);
});

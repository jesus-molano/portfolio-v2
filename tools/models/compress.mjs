/**
 * The hero's glTF models as the page loads them: the driver and the five
 * traffic cars (src/features/hero/scene/Driver.tsx and Traffic.tsx; the
 * career city clones the same files).
 *
 *     node tools/models/compress.mjs
 *
 * Reads the uncompressed models in tools/models/source, which is where the
 * Blender scripts write them and read them back (Blender cannot read a
 * meshopt-compressed file), and writes each to the same path under
 * public/models:
 * - its geometry quantized (KHR_mesh_quantization) and compressed
 *   (EXT_meshopt_compression). drei's useGLTF hands three-stdlib's
 *   GLTFLoader the meshopt decoder three-stdlib bundles (its WebAssembly is
 *   inlined, no CDN). That decoder predates meshoptimizer's version 1
 *   vertex codec, so the vertex streams are written in version 0, the one
 *   EXT_meshopt_compression specifies, and no filter newer than it is used
 *   (modelAssets.test.ts reads the streams' headers);
 * - the driver's skin texture at 1024 px instead of 2048 (`RESIZE`).
 * Nothing else changes: no node, mesh, material, skin or bone is renamed,
 * merged or removed (no join, flatten, weld, palette or general prune), so
 * every name Driver.tsx, driverPose.ts, NightDriver.tsx and Traffic.tsx look
 * up is still there. The convertible (Car.tsx reads its raw float arrays)
 * and the aviators (54 KB) are not compressed.
 *
 * It writes what it made each model from to tools/models/sources.json (the
 * SHA-256 of this script, of the source and of the model), and
 * src/features/hero/scene/modelAssets.test.ts fails on a model left behind.
 * Deterministic: a rerun with nothing changed writes the same bytes.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Logger, NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { prune, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SOURCE = "tools/models/source";
const PUBLIC = "public/models";
const SCRIPT = "tools/models/compress.mjs";
const RECORD = path.join(ROOT, "tools/models/sources.json");

/** The models, by their path under SOURCE and PUBLIC. */
const MODELS = [
  "makehuman-driver/driver.glb",
  ...["SportsCar", "SportsCar2", "NormalCar1", "Taxi", "SUV"].map((name) => `quaternius-cars/${name}.glb`),
];

/**
 * Quantization, the same for every model, chosen to be invisible rather than
 * the smallest (measured on the driver against his source):
 * - positions: 16 bits over one box per model, 0.02 mm on him. 14 bits made
 *   the file no smaller (meshopt codes the low bits either way). One box,
 *   not one per mesh: on him its scale and offset go into the skin's inverse
 *   bind matrices, and one box keeps the one skin all his meshes share, so
 *   the hero still updates one skeleton a frame (a box per mesh gave each
 *   mesh a skin of its own). On a car they go into its nodes' transforms,
 *   which nothing reads: the traffic rests on the road from the model's
 *   bounds, which three takes through those transforms;
 * - normals: 10 bits, under 0.1 degree. Meshopt's octahedral filter keeps 8
 *   bits, over a degree on his face (up to 2 % of the light, from one vertex
 *   to the next), for 76 KB saved;
 * - texture coordinates: 14 bits, 0.04 of a texel of a 2048 px texture
 *   (the hair texture holds one strand per texel);
 * - skin weights: 16 bits. 8 bits were off by up to 0.005, which moves a
 *   vertex by half a percent of the gap between two bones' poses, rounded
 *   one way on the tee and another on the skin under it;
 * - the hair shells' colours are 8 bits already and stay as they are.
 */
const QUANTIZE = {
  quantizationVolume: "scene",
  quantizePosition: 16,
  quantizeNormal: 10,
  quantizeTexcoord: 14,
  quantizeColor: 8,
  quantizeWeight: 16,
};

/**
 * Textures made smaller, by image name: the driver's skin, 2048 to 1024 px.
 * Each halving is a 2 x 2 average in linear light, as the GPU makes a
 * mipmap, so wherever the hero drew the skin from its 1024 level or below
 * it draws nearly the texels it drew before; only a closer look loses
 * detail. The hair texture keeps its size: one texel is one strand.
 */
const RESIZE = { "makehuman-driver/driver.glb": { skin: 1024 } };

/**
 * WebP for a resized texture. A second lossy encode (refine_driver_hair.py
 * wrote the skin at quality 84), with four of the old texels in each new
 * one, so a little higher than the first: at 84 the 1024 px skin came out
 * at 40.0 dB against its averaged texels, at 90 at 41.7 dB, for 28 KB more.
 */
const WEBP = { quality: 90, effort: 6 };

const sha256 = (file) => createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex");

/** The JSON chunk of a GLB. */
function glbJson(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString("utf8"));
}

/** sRGB byte to linear light, and back. */
const LINEAR = Float64Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const toSrgb = (l) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
};

/**
 * One mipmap step: each 2 x 2 block averaged, colour in linear light and
 * alpha as it is. Raw pixels in, raw pixels out.
 */
function halve(data, width, height, channels) {
  const w = width >> 1;
  const h = height >> 1;
  const out = Buffer.alloc(w * h * channels);
  const row = width * channels;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = 2 * y * row + 2 * x * channels;
      for (let c = 0; c < channels; c++) {
        const a = data[at + c];
        const b = data[at + channels + c];
        const d = data[at + row + c];
        const e = data[at + row + channels + c];
        out[(y * w + x) * channels + c] =
          c === 3 ? Math.round((a + b + d + e) / 4) : toSrgb((LINEAR[a] + LINEAR[b] + LINEAR[d] + LINEAR[e]) / 4);
      }
    }
  }
  return { data: out, width: w, height: h };
}

/** A WebP texture brought down to `size` px square by mipmap steps. */
async function shrink(image, size) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== info.height || info.width % size || !Number.isInteger(Math.log2(info.width / size))) {
    throw new Error(`a ${info.width} x ${info.height} texture does not halve down to ${size}`);
  }
  let level = { data, width: info.width, height: info.height };
  while (level.width > size) level = halve(level.data, level.width, level.height, info.channels);
  return sharp(level.data, { raw: { width: size, height: size, channels: info.channels } })
    .webp(WEBP)
    .toBuffer();
}

/**
 * Runs `step` with the indices of `prims` set aside, so a reorder leaves
 * their triangles in the order they were drawn in. Blended primitives (his
 * brows and lashes) are drawn without depth writes in triangle order, and
 * where two of their triangles overlap that order is the picture.
 */
async function sparing(prims, step) {
  const kept = prims.map((prim) => [prim, prim.getIndices()]);
  for (const [prim] of kept) prim.setIndices(null);
  try {
    await step();
  } finally {
    for (const [prim, indices] of kept) prim.setIndices(indices);
  }
}

await MeshoptEncoder.ready;
const logger = new Logger(Logger.Verbosity.WARN);
const io = new NodeIO()
  .setLogger(logger)
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const record = {};
for (const model of MODELS) {
  const source = `${SOURCE}/${model}`;
  const output = `${PUBLIC}/${model}`;
  const sourceBytes = fs.readFileSync(path.join(ROOT, source));
  const used = glbJson(sourceBytes).extensionsUsed ?? [];
  if (used.includes("EXT_meshopt_compression") || used.includes("KHR_mesh_quantization")) {
    throw new Error(`${source} is already compressed: the sources are the uncompressed Blender output`);
  }

  const doc = (await io.readBinary(new Uint8Array(sourceBytes))).setLogger(logger);
  const root = doc.getRoot();

  for (const [name, size] of Object.entries(RESIZE[model] ?? {})) {
    const texture = root.listTextures().find((t) => t.getName() === name);
    if (!texture || texture.getMimeType() !== "image/webp") throw new Error(`${source} has no WebP texture "${name}"`);
    texture.setImage(new Uint8Array(await shrink(texture.getImage(), size)));
  }

  // Vertex cache and fetch order, for the GPU and the codec. reorder's own
  // cleanup would drop the indices set aside: the prune below runs instead.
  const blended = root
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .filter((prim) => prim.getMaterial()?.getAlphaMode() === "BLEND" && prim.getIndices());
  await sparing(blended, () => doc.transform(reorder({ encoder: MeshoptEncoder, target: "size", cleanup: false })));
  // Its cleanup prunes and dedups accessors, skins and materials only, and
  // keeps every name: the driver's eight copies of his skin (one per mesh,
  // each with the box in its matrices) are one again.
  await doc.transform(quantize(QUANTIZE));
  // The inverse bind matrices of the copies dedup let go.
  await doc.transform(prune({ propertyTypes: [PropertyType.ACCESSOR], keepAttributes: true, keepIndices: true }));
  // The attributes as quantized above, losslessly: the filter method would
  // cut the normals to 8 bits.
  doc.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  const bytes = await io.writeBinary(doc);
  fs.writeFileSync(path.join(ROOT, output), bytes);
  record[output] = {
    files: { [SCRIPT]: sha256(SCRIPT), [source]: sha256(source) },
    model: sha256(output),
    bytes: { source: sourceBytes.length, model: bytes.length },
  };
  const percent = Math.round((100 * bytes.length) / sourceBytes.length);
  console.log(`${output}: ${sourceBytes.length} -> ${bytes.length} bytes (${percent} %), ${root.listSkins().length} skin(s)`);
}

fs.writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`);
console.log(`wrote ${path.relative(ROOT, RECORD)}`);

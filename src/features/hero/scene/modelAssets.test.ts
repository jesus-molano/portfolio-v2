import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BONES } from "./driverPose";

/**
 * The glTF models the page loads, read as files (their JSON and binary
 * chunks; no loader): tools/models/compress.mjs makes the driver and the
 * traffic cars from their sources in tools/models/source.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const DRIVER = "public/models/makehuman-driver/driver.glb";
const CARS = ["SportsCar", "SportsCar2", "NormalCar1", "Taxi", "SUV"].map((name) => `public/models/quaternius-cars/${name}.glb`);
const COMPRESSED = [DRIVER, ...CARS];
/** Car.tsx reads the convertible's raw float arrays (`rimUvCircle`); the aviators are 54 KB. */
const UNCOMPRESSED = ["public/models/poly-convertible/convertible.glb", "public/models/sunglasses/aviator.glb"];

type Meshopt = { buffer: number; byteOffset?: number; byteLength: number; mode: string; filter?: string };
type Gltf = {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  nodes: Array<{ name?: string; mesh?: number; skin?: number }>;
  meshes: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number }> }>;
  materials?: Array<{ name?: string }>;
  skins?: Array<{ joints: number[] }>;
  accessors: Array<{ bufferView?: number; componentType: number }>;
  bufferViews: Array<{ buffer: number; byteOffset?: number; byteLength: number; extensions?: { EXT_meshopt_compression?: Meshopt } }>;
  images?: Array<{ name?: string; mimeType?: string; bufferView?: number }>;
};

const FLOAT = 5126;

/** A GLB's JSON and its binary chunk. */
function readGlb(file: string): { json: Gltf; bin: Buffer } {
  const bytes = fs.readFileSync(path.join(ROOT, file));
  expect(bytes.readUInt32LE(0), `${file} is a GLB`).toBe(0x46546c67);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as Gltf;
  const binAt = 20 + jsonLength;
  return { json, bin: bytes.subarray(binAt + 8, binAt + 8 + bytes.readUInt32LE(binAt)) };
}

/** The bytes of a buffer view that is stored in the binary chunk. */
function viewBytes(json: Gltf, bin: Buffer, index: number) {
  const view = json.bufferViews[index];
  expect(view.buffer).toBe(0);
  return bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

/** A WebP's width and height (lossy, lossless or extended). */
function webpSize(data: Buffer): [number, number] {
  expect(data.subarray(8, 12).toString("latin1")).toBe("WEBP");
  const chunk = data.subarray(12, 16).toString("latin1");
  if (chunk === "VP8 ") return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") {
    const bits = data.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  expect(chunk).toBe("VP8X");
  return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
}

const sha256 = (file: string) => createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex");
const materialNames = (json: Gltf) => (json.materials ?? []).map((material) => material.name ?? "");

describe("the page's glTF models", () => {
  for (const file of COMPRESSED) {
    it(`${file}: is quantized, and every accessor meshopt-compressed`, () => {
      const { json } = readGlb(file);
      expect(json.extensionsRequired).toEqual(expect.arrayContaining(["EXT_meshopt_compression", "KHR_mesh_quantization"]));
      for (const accessor of json.accessors) {
        expect(accessor.bufferView).toBeDefined();
        expect(json.bufferViews[accessor.bufferView!].extensions?.EXT_meshopt_compression).toBeDefined();
      }
    });

    it(`${file}: is coded in streams the site's meshopt decoder reads`, () => {
      // drei's useGLTF decodes with the MeshoptDecoder three-stdlib bundles,
      // which predates meshoptimizer's version 1 vertex codec and its colour
      // filter: vertex streams must be version 0 (header 0xa0), index streams
      // version 0 or 1 (0xe0, 0xe1), and the filters the ones it knows.
      const { json, bin } = readGlb(file);
      const streams = json.bufferViews.flatMap((view) => view.extensions?.EXT_meshopt_compression ?? []);
      expect(streams.length).toBeGreaterThan(0);
      for (const stream of streams) {
        expect(stream.buffer).toBe(0);
        const header = bin[stream.byteOffset ?? 0];
        if (stream.mode === "ATTRIBUTES") expect(header).toBe(0xa0);
        else {
          expect(stream.mode).toBe("TRIANGLES");
          expect([0xe0, 0xe1]).toContain(header);
        }
        expect(["NONE", "OCTAHEDRAL", "QUATERNION", "EXPONENTIAL"]).toContain(stream.filter ?? "NONE");
      }
    });
  }

  for (const file of UNCOMPRESSED) {
    it(`${file}: is neither quantized nor compressed`, () => {
      const { json } = readGlb(file);
      expect(json.extensionsUsed ?? []).not.toContain("EXT_meshopt_compression");
      expect(json.extensionsUsed ?? []).not.toContain("KHR_mesh_quantization");
      for (const primitive of json.meshes.flatMap((mesh) => mesh.primitives)) {
        for (const name of ["POSITION", "TEXCOORD_0"]) {
          const index = primitive.attributes[name];
          if (index !== undefined) expect(json.accessors[index].componentType).toBe(FLOAT);
        }
      }
    });
  }

  it("the driver keeps every bone and material the code looks up by name", () => {
    const { json } = readGlb(DRIVER);
    // driverPose.ts poses these; Driver.tsx and NightDriver.tsx collect the
    // bones (the skin's joints), and the glasses ride on "head".
    const sides = ["l", "r"] as const;
    const bones = [
      BONES.spine,
      BONES.head,
      ...sides.flatMap((side) => [BONES.upperArm(side), BONES.lowerArm(side), BONES.hand(side), BONES.thigh(side), BONES.calf(side), BONES.foot(side)]),
      ...sides.flatMap((side) =>
        ["index", "middle", "ring", "pinky"].flatMap((finger) => ([1, 2, 3] as const).map((joint) => BONES.finger(finger, joint, side))),
      ),
      ...sides.map((side) => BONES.finger("thumb", 2, side)),
    ];
    const joints = (json.skins ?? []).flatMap((skin) => skin.joints.map((index) => json.nodes[index].name));
    for (const bone of bones) expect(joints, bone).toContain(bone);
    // Driver.tsx: the hair shells' alpha test, the brows' and lashes' single pass, the earring's look.
    const materials = materialNames(json);
    expect(materials).toEqual(expect.arrayContaining(["HairShell0", "HairShell1", "HairShell2", "Brows", "Lashes", "Earring"]));
  });

  it("the driver's meshes share one skin, so the hero updates one skeleton a frame", () => {
    const { json } = readGlb(DRIVER);
    expect(json.skins).toHaveLength(1);
    const skinned = json.nodes.filter((node) => node.mesh !== undefined);
    expect(skinned.length).toBeGreaterThan(0);
    for (const node of skinned) expect(node.skin, node.name).toBe(0);
  });

  it("the driver's skin texture is 1024 px; the hair keeps its 1024, one strand per texel", () => {
    const { json, bin } = readGlb(DRIVER);
    const size = (name: string) => {
      const image = (json.images ?? []).find((candidate) => candidate.name === name);
      expect(image?.mimeType, name).toBe("image/webp");
      return webpSize(viewBytes(json, bin, image!.bufferView!));
    };
    expect(size("skin")).toEqual([1024, 1024]);
    expect(size("hair")).toEqual([1024, 1024]);
  });

  for (const file of CARS) {
    it(`${file}: keeps the lamps and the glass Traffic.tsx dresses by name`, () => {
      const materials = materialNames(readGlb(file).json).map((name) => name.toLowerCase());
      for (const part of ["headlight", "taillight", "window"]) expect(materials.some((name) => name.includes(part)), part).toBe(true);
    });
  }

  it("were made by tools/models/compress.mjs from their sources as they are now", () => {
    const rebuild = "recompress the models: node tools/models/compress.mjs";
    type Made = Record<string, { files: Record<string, string>; model: string }>;
    const made: Made = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/models/sources.json"), "utf8"));
    expect(Object.keys(made).sort(), rebuild).toEqual([...COMPRESSED].sort());
    for (const [model, { files, model: hash }] of Object.entries(made)) {
      const source = model.replace("public/models/", "tools/models/source/");
      expect(Object.keys(files), rebuild).toEqual(expect.arrayContaining(["tools/models/compress.mjs", source]));
      for (const [file, sum] of Object.entries(files)) expect(sha256(file), `${rebuild} (${file} changed)`).toBe(sum);
      expect(sha256(model), `${rebuild} (${model} was changed by hand)`).toBe(hash);
      // The sources stay as Blender wrote them: the Blender scripts read them back.
      const { json } = readGlb(source);
      expect(json.extensionsUsed ?? [], source).not.toContain("EXT_meshopt_compression");
    }
  });
});

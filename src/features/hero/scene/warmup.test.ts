import {
  BoxGeometry,
  Color,
  DataTexture,
  Group,
  HalfFloatType,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  ShaderMaterial,
  Texture,
  type WebGLRenderTarget,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { compileAsComposed, createWarmTarget, downloadsDone, holdsLight, isWarm, markWarm, texturesOf, uploadTextures, warmKey } from "./warmup";

/** A texture with an image in it (version 1), as a loader or a painted canvas leaves it. */
function filled(): Texture {
  const texture = new Texture();
  texture.needsUpdate = true;
  return texture;
}

/** A renderer's target and compile calls, recorded (no WebGL in Node). */
function fakeRenderer(compile: () => Promise<unknown> = () => Promise.resolve()) {
  const own = { name: "own" } as unknown as WebGLRenderTarget;
  let bound: WebGLRenderTarget | null = own;
  const boundDuringCompile: (WebGLRenderTarget | null)[] = [];
  const gl = {
    getRenderTarget: () => bound,
    getActiveCubeFace: () => 3,
    getActiveMipmapLevel: () => 1,
    setRenderTarget: vi.fn((target: WebGLRenderTarget | null) => {
      bound = target;
    }),
    compileAsync: vi.fn((root: Object3D) => {
      boundDuringCompile.push(bound);
      return compile().then(() => root);
    }),
  };
  return { gl, own, boundDuringCompile, bound: () => bound };
}

describe("texturesOf", () => {
  it("collects a material's maps and its uniforms' textures, arrays too, once each", () => {
    const map = filled();
    const atlas = filled();
    const lut = new DataTexture(new Uint8Array(4), 1, 1);
    const shadow = filled();
    const standard = new MeshStandardMaterial({ map, emissiveMap: map, color: new Color() });
    expect([...texturesOf(standard)]).toEqual([map]);
    const shader = new ShaderMaterial({
      uniforms: {
        uMap: { value: atlas },
        uLut: { value: lut },
        uShadows: { value: [shadow, null, atlas] },
        uColor: { value: new Color() },
        uLevel: { value: 0.3 },
        uNone: { value: null },
      },
    });
    expect([...texturesOf(shader)]).toEqual([atlas, lut, shadow]);
  });

  it("adds to a set it is given", () => {
    const map = filled();
    const into = new Set<Texture>([map]);
    texturesOf(new MeshStandardMaterial({ map }), into);
    expect(into.size).toBe(1);
  });
});

describe("uploadTextures", () => {
  it("uploads every texture under a group once, and leaves an empty one for later", () => {
    const map = filled();
    const atlas = filled();
    const empty = new Texture();
    const geometry = new BoxGeometry();
    const root = new Group();
    root.add(
      new Mesh(geometry, new MeshStandardMaterial({ map })),
      new Mesh(geometry, [new MeshStandardMaterial({ map }), new ShaderMaterial({ uniforms: { uAtlas: { value: atlas } } })]),
      new Mesh(geometry, new MeshStandardMaterial({ map: empty })),
    );
    const gl = { initTexture: vi.fn() };
    const seen = new WeakSet<Texture>();
    expect(uploadTextures(gl, root, seen)).toBe(2);
    expect(gl.initTexture.mock.calls.map(([texture]) => texture)).toEqual([map, atlas]);
    // Looked at again: nothing twice, and the empty one once it has an image.
    expect(uploadTextures(gl, root, seen)).toBe(0);
    empty.needsUpdate = true;
    expect(uploadTextures(gl, root, seen)).toBe(1);
    expect(gl.initTexture).toHaveBeenLastCalledWith(empty);
  });

  it("uploads at most as many as it is allowed, the rest at the next look", () => {
    const geometry = new BoxGeometry();
    const maps = [filled(), filled(), filled()];
    const root = new Group();
    for (const map of maps) root.add(new Mesh(geometry, new MeshStandardMaterial({ map })));
    const gl = { initTexture: vi.fn() };
    const seen = new WeakSet<Texture>();
    expect(uploadTextures(gl, root, seen, 1)).toBe(1);
    expect(uploadTextures(gl, root, seen, 1)).toBe(1);
    expect(uploadTextures(gl, root, seen, 1)).toBe(1);
    expect(uploadTextures(gl, root, seen, 1)).toBe(0);
    expect(gl.initTexture.mock.calls.map(([texture]) => texture)).toEqual(maps);
  });
});

describe("warmKey", () => {
  it("changes when a model lands or a board's art is painted, not when a value changes", () => {
    const geometry = new BoxGeometry();
    const root = new Group();
    expect(warmKey(root)).toBeNull();
    const uniforms = { uMap: { value: null as Texture | null }, uLevel: { value: 0 } };
    root.add(new Mesh(geometry, new ShaderMaterial({ uniforms })));
    const bare = warmKey(root);
    expect(bare).not.toBeNull();
    uniforms.uLevel.value = 1;
    expect(warmKey(root)).toBe(bare);
    uniforms.uMap.value = filled();
    const painted = warmKey(root);
    expect(painted).not.toBe(bare);
    root.add(new Mesh(geometry, new MeshStandardMaterial()));
    expect(warmKey(root)).not.toBe(painted);
  });
});

describe("createWarmTarget", () => {
  it("is a 1 x 1 half-float target, the composer's own kind", () => {
    const target = createWarmTarget();
    expect([target.width, target.height]).toEqual([1, 1]);
    expect(target.texture.type).toBe(HalfFloatType);
    target.dispose();
  });
});

describe("compileAsComposed", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const warm = { name: "warm" } as unknown as WebGLRenderTarget;

  it("compiles with the warm target bound and gives the renderer its own back after", async () => {
    const { gl, own, boundDuringCompile, bound } = fakeRenderer();
    const group = new Group();
    await compileAsComposed(gl, group, camera, scene, warm);
    expect(gl.compileAsync).toHaveBeenCalledWith(group, camera, scene);
    expect(boundDuringCompile).toEqual([warm]);
    expect(bound()).toBe(own);
    expect(gl.setRenderTarget).toHaveBeenLastCalledWith(own, 3, 1);
  });

  it("compiles a part holding lights as the whole scene, or three.js counts its lights twice", async () => {
    const { gl } = fakeRenderer();
    const lit = new Group();
    lit.add(new PointLight());
    const dark = new Group();
    dark.add(new Group());
    scene.add(lit, dark);
    await compileAsComposed(gl, lit, camera, scene, warm);
    await compileAsComposed(gl, dark, camera, scene, warm);
    await compileAsComposed(gl, scene, camera, scene, warm);
    expect(gl.compileAsync.mock.calls.map(([root]) => root)).toEqual([scene, dark, scene]);
    expect(holdsLight(lit)).toBe(true);
    expect(holdsLight(dark)).toBe(false);
    scene.remove(lit, dark);
  });

  it("restores the target before the programs are linked", () => {
    let link: () => void = () => undefined;
    const { gl, own, bound } = fakeRenderer(
      () =>
        new Promise<void>((resolve) => {
          link = resolve;
        }),
    );
    const pending = compileAsComposed(gl, new Group(), camera, scene, warm);
    expect(bound()).toBe(own);
    link();
    return pending;
  });

  it("restores the target and rejects when compiling throws", async () => {
    const { gl, own, bound } = fakeRenderer(() => {
      throw new Error("context lost");
    });
    await expect(compileAsComposed(gl, new Group(), camera, scene, warm)).rejects.toThrow("context lost");
    expect(bound()).toBe(own);
  });
});

describe("downloadsDone", () => {
  it("waits for a first model to start counting, then for every file", () => {
    // drei's store before the first model arrives: nothing active, nothing to load.
    expect(downloadsDone({ active: false, loaded: 0, total: 0 })).toBe(false);
    expect(downloadsDone({ active: true, loaded: 2, total: 5 })).toBe(false);
    expect(downloadsDone({ active: true, loaded: 5, total: 5 })).toBe(false);
    expect(downloadsDone({ active: false, loaded: 5, total: 5 })).toBe(true);
  });
});

describe("markWarm", () => {
  it("marks one renderer's canvas warm, no other", () => {
    const one = {};
    const other = {};
    markWarm(one);
    expect(isWarm(one)).toBe(true);
    expect(isWarm(other)).toBe(false);
  });
});

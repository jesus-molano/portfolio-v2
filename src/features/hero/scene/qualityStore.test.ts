import { afterEach, describe, expect, it } from "vitest";
import { COMMIT_MS, LAST_LEVEL, LEVELS } from "./degrade";
import {
  commitIfDue,
  getQuality,
  getServerQuality,
  lockStructure,
  markCut,
  qualityRuntime,
  reportRefresh,
  requestDecline,
  resetQuality,
  seedFromRenderer,
  subscribeQuality,
} from "./qualityStore";

/** A renderer whose GPU calls itself `name` (as Firefox does, through RENDERER). */
function renderer(name: string) {
  return {
    getContext: () =>
      ({
        RENDERER: 0x1f01,
        getParameter: () => name,
        getExtension: () => null,
      }) as unknown as WebGL2RenderingContext,
  };
}

const UHD = "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)";
const IRIS = "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)";
const RTX = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)";

afterEach(() => resetQuality());

describe("qualityStore", () => {
  it("starts at the top of the ladder, as on the server", () => {
    resetQuality();
    expect(getQuality()).toBe(getServerQuality());
    expect(getQuality().level).toBe(0);
    expect(qualityRuntime.depthOfField).toBe(true);
    expect(qualityRuntime.cloudOctaves).toBe(LEVELS[0].cloudOctaves);
  });

  it("seeds once, from the first renderer, and mirrors the level for the frames", () => {
    resetQuality();
    seedFromRenderer(renderer(UHD));
    expect(getQuality().gpu).toBe("low");
    expect(getQuality().level).toBe(4);
    expect(qualityRuntime.level).toBe(4);
    expect(qualityRuntime.depthOfField).toBe(LEVELS[4].depthOfField);
    expect(qualityRuntime.cloudShadow).toBe(false);
    // The night's renderer, later: the visit keeps what the hero's started.
    seedFromRenderer(renderer(RTX));
    expect(getQuality().gpu).toBe("low");
  });

  it("keeps a development build on level 0 whatever the GPU", () => {
    resetQuality({ dev: true });
    seedFromRenderer(renderer(UHD));
    expect(getQuality().level).toBe(0);
    expect(getQuality().structure.smaa).toBe("high");
  });

  it("lands a decline under the next cut, or after COMMIT_MS without one", () => {
    resetQuality();
    seedFromRenderer(renderer(RTX));
    requestDecline(60, 1000);
    expect(getQuality().pending).toBe(1);
    expect(getQuality().level).toBe(0);
    commitIfDue(1500);
    expect(getQuality().level).toBe(0);
    markCut(1600);
    expect(getQuality().level).toBe(1);
    expect(qualityRuntime.level).toBe(1);

    requestDecline(60, 5000);
    commitIfDue(5000 + COMMIT_MS - 1);
    expect(getQuality().level).toBe(1);
    commitIfDue(5000 + COMMIT_MS);
    expect(getQuality().level).toBe(2);
  });

  it("does not count a cut from before the decline", () => {
    resetQuality();
    seedFromRenderer(renderer(RTX));
    markCut(900);
    requestDecline(60, 1000);
    commitIfDue(1100);
    expect(getQuality().level).toBe(0);
  });

  it("freezes the post's structure once she has entered", () => {
    resetQuality();
    seedFromRenderer(renderer(RTX));
    const structure = getQuality().structure;
    lockStructure();
    requestDecline(60, 0);
    markCut(10);
    requestDecline(60, 3000);
    markCut(3010);
    expect(getQuality().level).toBe(2);
    expect(getQuality().structure).toBe(structure);
  });

  it("goes to half rate first on a fast display, and a GPU below the top as soon as the rate is known", () => {
    resetQuality();
    seedFromRenderer(renderer(RTX));
    requestDecline(144, 0);
    expect(getQuality().halfRate).toBe(true);
    expect(getQuality().pending).toBeNull();

    resetQuality();
    seedFromRenderer(renderer(IRIS));
    expect(getQuality().halfRate).toBe(false);
    reportRefresh(144);
    expect(getQuality().halfRate).toBe(true);
    expect(qualityRuntime.halfRate).toBe(true);
    expect(qualityRuntime.refreshHz).toBe(144);

    resetQuality();
    seedFromRenderer(renderer(RTX));
    reportRefresh(165);
    expect(getQuality().halfRate).toBe(false);
  });

  it("tells its subscribers only when something changed", () => {
    resetQuality();
    let calls = 0;
    const off = subscribeQuality(() => {
      calls += 1;
    });
    seedFromRenderer(renderer(RTX));
    const after = calls;
    commitIfDue(10_000);
    lockStructure();
    lockStructure();
    expect(calls).toBe(after + 1);
    off();
  });

  it("never steps below the last level", () => {
    resetQuality();
    seedFromRenderer(renderer(RTX));
    for (let i = 0; i < 20; i++) {
      requestDecline(60, i * 3000);
      markCut(i * 3000 + 1);
    }
    expect(getQuality().level).toBe(LAST_LEVEL);
  });
});

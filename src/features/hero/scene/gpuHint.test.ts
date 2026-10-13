import { describe, expect, it } from "vitest";
import { classifyRenderer, needsNanGuard, rendererString } from "./gpuHint";

/** Renderer strings as browsers report them. */
const STRINGS = {
  irisXe: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  uhd620: "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  hd520: "Intel(R) HD Graphics 520",
  mesaUhd: "Mesa Intel(R) UHD Graphics 620 (KBL GT2)",
  rtx3060: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ryzen: "ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  mesaRyzen: "AMD Radeon Graphics (renoir, LLVM 15.0.7, DRM 3.49, 6.1.0)",
  vega: "ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
  arc: "ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  swiftShader: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
  llvmpipe: "llvmpipe (LLVM 15.0.7, 256 bits)",
  basic: "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
  appleGpu: "Apple GPU",
  appleM1: "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
  mali: "ANGLE (ARM, Mali-G57 MC2, OpenGL ES 3.2)",
  adreno: "Adreno (TM) 650",
  nvidiaLinux: "NVIDIA GeForce RTX 3060/PCIe/SSE2",
} as const;

const UA = {
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
} as const;

describe("classifyRenderer", () => {
  it("knows the software rasterisers", () => {
    expect(classifyRenderer(STRINGS.swiftShader)).toBe("software");
    expect(classifyRenderer(STRINGS.llvmpipe)).toBe("software");
    expect(classifyRenderer(STRINGS.basic)).toBe("software");
    expect(classifyRenderer("Microsoft Basic Render Driver")).toBe("software");
  });

  it("puts Intel's plain HD and UHD graphics low, Iris in the middle and Arc at the top", () => {
    expect(classifyRenderer(STRINGS.uhd620)).toBe("low");
    expect(classifyRenderer(STRINGS.hd520)).toBe("low");
    expect(classifyRenderer(STRINGS.mesaUhd)).toBe("low");
    expect(classifyRenderer(STRINGS.irisXe)).toBe("mid");
    expect(classifyRenderer(STRINGS.arc)).toBe("top");
  });

  it("puts AMD's integrated Radeon in the middle", () => {
    expect(classifyRenderer(STRINGS.ryzen)).toBe("mid");
    expect(classifyRenderer(STRINGS.mesaRyzen)).toBe("mid");
    expect(classifyRenderer(STRINGS.vega)).toBe("mid");
  });

  it("starts every other or unknown GPU at the top: the monitor catches a wrong guess", () => {
    expect(classifyRenderer(STRINGS.rtx3060)).toBe("top");
    expect(classifyRenderer(STRINGS.appleGpu)).toBe("top");
    expect(classifyRenderer(STRINGS.appleM1)).toBe("top");
    expect(classifyRenderer(STRINGS.mali)).toBe("top");
    expect(classifyRenderer(STRINGS.adreno)).toBe("top");
    expect(classifyRenderer("WebKit WebGL")).toBe("top");
    expect(classifyRenderer(null)).toBe("top");
    expect(classifyRenderer("")).toBe("top");
  });
});

describe("needsNanGuard", () => {
  it("keeps the guard on Mesa and llvmpipe, whatever the platform says", () => {
    expect(needsNanGuard(STRINGS.mesaUhd, UA.windows)).toBe(true);
    expect(needsNanGuard(STRINGS.llvmpipe, "")).toBe(true);
  });

  it("keeps it on a Linux desktop, even with a masked or proprietary renderer", () => {
    expect(needsNanGuard(STRINGS.nvidiaLinux, UA.linux)).toBe(true);
    expect(needsNanGuard(null, UA.linux)).toBe(true);
  });

  it("spares the pass on Windows, macOS and Android", () => {
    expect(needsNanGuard(STRINGS.rtx3060, UA.windows)).toBe(false);
    expect(needsNanGuard(STRINGS.appleGpu, UA.mac)).toBe(false);
    expect(needsNanGuard(STRINGS.adreno, UA.android)).toBe(false);
    expect(needsNanGuard(null, UA.android)).toBe(false);
  });
});

/** A context that answers what a browser would. */
function fakeGl({ plain, unmasked }: { plain: string; unmasked?: string }) {
  const RENDERER = 0x1f01;
  const UNMASKED = 0x9246;
  let asked = 0;
  return {
    gl: {
      RENDERER,
      getParameter: (name: number) => (name === RENDERER ? plain : name === UNMASKED ? unmasked : null),
      getExtension: (name: string) => {
        asked += 1;
        return name === "WEBGL_debug_renderer_info" && unmasked !== undefined ? { UNMASKED_RENDERER_WEBGL: UNMASKED } : null;
      },
    } as unknown as Parameters<typeof rendererString>[0],
    asked: () => asked,
  };
}

describe("rendererString", () => {
  it("unmasks Chrome's and Safari's generic name through the debug extension", () => {
    expect(rendererString(fakeGl({ plain: "WebKit WebGL", unmasked: STRINGS.uhd620 }).gl)).toBe(STRINGS.uhd620);
  });

  it("takes Firefox's own name as it is, without asking for the extension it warns about", () => {
    const fake = fakeGl({ plain: STRINGS.irisXe, unmasked: "should not be read" });
    expect(rendererString(fake.gl)).toBe(STRINGS.irisXe);
    expect(fake.asked()).toBe(0);
  });

  it("falls back to the masked name when there is no extension", () => {
    expect(rendererString(fakeGl({ plain: "WebKit WebGL" }).gl)).toBe("WebKit WebGL");
  });

  it("gives null when the context throws", () => {
    const gl = {
      RENDERER: 0x1f01,
      getParameter: () => {
        throw new Error("lost");
      },
      getExtension: () => null,
    } as unknown as Parameters<typeof rendererString>[0];
    expect(rendererString(gl)).toBeNull();
  });
});

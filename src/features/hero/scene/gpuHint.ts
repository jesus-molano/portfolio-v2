/**
 * What the browser says about the GPU, read locally (no network call, no
 * benchmark): where a visit starts on the quality ladder (degrade.ts), and
 * whether the night needs its net for broken pixels (NanGuard).
 *
 * Every desktop used to start at full quality, from an integrated Intel
 * chip to a gaming card, and a weak one spent the first minutes of the film
 * stepping down through it. A string can misjudge: an unknown or masked one
 * starts at the top, and the frame-rate monitor (qualityMonitor.ts) catches
 * what it got wrong.
 */
export type GpuClass = "top" | "mid" | "low" | "software";

/** Software rasterisers: every pixel drawn by the CPU. */
const SOFTWARE = /SwiftShader|llvmpipe|softpipe|Basic Render|Microsoft Basic|Software/i;
/** Intel's plain integrated graphics, HD and UHD; Iris and Arc are more. */
const INTEL_PLAIN = /Intel.*\bU?HD Graphics/i;
const INTEL_MORE = /Iris|\bArc\b/i;
/** Iris, and AMD's integrated Radeon (Ryzen's "Radeon(TM) Graphics", Vega). */
const MID = /Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega/i;
/** Mesa's drivers (a Linux desktop, a Chromebook) and its software one. */
const MESA = /Mesa|llvmpipe/i;
/** The masked strings a browser gives instead of the GPU's own name. */
const MASKED = /^(WebKit WebGL|Mozilla)$/i;

type RendererInfo = { UNMASKED_RENDERER_WEBGL: number };
type GlLike = Pick<WebGLRenderingContext, "getParameter" | "getExtension" | "RENDERER">;

/**
 * The renderer's own name, or null. Firefox gives the real name (sanitised)
 * in `RENDERER` and warns about the debug extension, so a name that says
 * something is taken as it is; Chrome and Safari mask it there ("WebKit
 * WebGL") and give it through `WEBGL_debug_renderer_info`.
 */
export function rendererString(gl: GlLike): string | null {
  try {
    const plain = gl.getParameter(gl.RENDERER) as unknown;
    if (typeof plain === "string" && plain.trim() !== "" && !MASKED.test(plain.trim())) return plain;
    const info = gl.getExtension("WEBGL_debug_renderer_info") as RendererInfo | null;
    if (info) {
      const unmasked = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) as unknown;
      if (typeof unmasked === "string" && unmasked.trim() !== "") return unmasked;
    }
    return typeof plain === "string" && plain.trim() !== "" ? plain : null;
  } catch {
    return null;
  }
}

/** The GPU's class from its renderer string; unknown or masked is "top". */
export function classifyRenderer(renderer: string | null): GpuClass {
  if (!renderer) return "top";
  if (SOFTWARE.test(renderer)) return "software";
  if (INTEL_PLAIN.test(renderer) && !INTEL_MORE.test(renderer)) return "low";
  if (MID.test(renderer)) return "mid";
  return "top";
}

/**
 * Whether the night's frame needs NanGuard (night/NanGuard.tsx), a pass of
 * its own: only Mesa's drivers ever handed it a broken pixel (a Linux
 * desktop, in Brave and Firefox alike), so a Mesa or llvmpipe renderer
 * keeps it, and so does any Linux that is not Android, whose renderer
 * string may be masked or sanitised. Everywhere else the pass is spared.
 * `platform` is the user agent.
 */
export function needsNanGuard(renderer: string | null, platform: string): boolean {
  if (renderer && MESA.test(renderer)) return true;
  return /Linux/i.test(platform) && !/Android/i.test(platform);
}

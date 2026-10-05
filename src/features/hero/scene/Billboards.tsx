"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";
import { palette, typography } from "@/design/tokens";
import { heroProgress } from "../scroll/heroProgress";
import { billboardFragmentShader, billboardVertexShader, createGlowUniforms } from "../shaders/neon";
import {
  type AtlasRect,
  type Billboard,
  buildBillboards,
  fitLines,
  glowTone,
  neonLevel,
  packAtlas,
} from "./billboardLayout";
import { buildFrontage } from "./cityLayout";

type Props = {
  /** One line of copy per board, in order (hero.billboards). */
  texts: string[];
};

/** Atlas width in pixels: a board fills a few hundred on screen at most. */
const ATLAS_WIDTH = 768;
const GUTTER = 8;
/** Display weight of the title, so the boards speak with the same voice. */
const WEIGHT = 800;
/**
 * The tubes reach past the bloom threshold; the dark board stays dark. The
 * boards take part of the haze: at 200-300 m they still read.
 */
const LOOK = { intensity: 2.4, fogAmount: 0.45 } as const;

const Y_AXIS = new Vector3(0, 1, 0);

/** The display font as the page loaded it (next/font), with the token's fallbacks. */
function displayFamily(): string {
  const loaded = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  const fallback = typography.display.replace(/^var\(--font-display\),\s*/, "");
  return loaded ? `${loaded}, ${fallback}` : fallback;
}

/** The dark violet board behind the copy, and a thin neon frame in its tube colour. */
function drawBoard(ctx: CanvasRenderingContext2D, rect: AtlasRect, tube: string) {
  const fill = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  fill.addColorStop(0, palette.ink);
  fill.addColorStop(1, palette.night);
  ctx.fillStyle = fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const inset = rect.h * 0.07;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = tube;
  ctx.lineWidth = Math.max(2, rect.h * 0.022);
  ctx.shadowColor = tube;
  ctx.shadowBlur = rect.h * 0.05;
  ctx.strokeRect(rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2);
  ctx.restore();
}

/** Neon copy: a wide glow in the tube colour (never too light), then a hot, paler core. */
function drawCopy(ctx: CanvasRenderingContext2D, rect: AtlasRect, board: Billboard, text: string, family: string) {
  const lines = fitLines(text, board.w / board.h);
  let size = lines.length === 1 ? rect.h * 0.56 : (rect.h * 0.7) / (lines.length * 1.12);
  ctx.font = `${WEIGHT} ${size}px ${family}`;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  size *= Math.min(1, (rect.w * 0.82) / Math.max(1, widest));
  ctx.font = `${WEIGHT} ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const core = new Color(board.color).lerp(new Color(palette.cream), 0.6).getStyle();
  const lineHeight = size * 1.12;
  const top = rect.y + rect.h / 2 - (lineHeight * (lines.length - 1)) / 2;
  const cx = rect.x + rect.w / 2;
  const halo = glowTone(board.color);
  ctx.save();
  ctx.fillStyle = halo;
  ctx.shadowColor = halo;
  ctx.shadowBlur = size * 0.45;
  for (let pass = 0; pass < 2; pass++) lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight));
  ctx.fillStyle = core;
  ctx.shadowBlur = size * 0.1;
  lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight));
  ctx.restore();
}

/**
 * Neon rooftop billboards along the avenue (layout in billboardLayout.ts):
 * the copy is drawn once into one canvas texture atlas, in the site's
 * display font, and every face shows its own rectangle of it. Two
 * instanced draws: the faces, and the panels and posts.
 */
export function Billboards({ texts }: Props) {
  const invalidate = useThree((state) => state.invalidate);
  const layout = useMemo(() => buildBillboards(buildFrontage()), []);
  const atlas = useMemo(() => packAtlas(layout.boards, ATLAS_WIDTH, GUTTER), [layout]);
  const copy = texts.join("\n");

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = atlas.width;
    canvas.height = atlas.height;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    return map;
  }, [atlas]);
  useEffect(() => () => texture.dispose(), [texture]);

  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(1, 1);
    const rects = new Float32Array(atlas.rects.length * 4);
    atlas.rects.forEach((rect, i) => rects.set([rect.u0, rect.v0, rect.u1, rect.v1], i * 4));
    plane.setAttribute("aUvRect", new InstancedBufferAttribute(rects, 4));
    const levels = new InstancedBufferAttribute(new Float32Array(atlas.rects.length).fill(1), 1);
    levels.setUsage(DynamicDrawUsage);
    plane.setAttribute("aLevel", levels);
    return plane;
  }, [atlas]);

  // The tubes come on one board after another as the title leaves.
  useFrame(() => {
    const levels = geometry.getAttribute("aLevel") as InstancedBufferAttribute;
    let changed = false;
    for (let i = 0; i < levels.count; i++) {
      const level = neonLevel(heroProgress.value, i);
      if (levels.getX(i) !== level) {
        levels.setX(i, level);
        changed = true;
      }
    }
    if (changed) levels.needsUpdate = true;
  });
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => {
    const merged = createGlowUniforms(LOOK.fogAmount, LOOK.intensity);
    // Set after the merge, which would clone the texture.
    merged.uMap = { value: texture };
    return merged;
  }, [texture]);

  // Boards first, then the copy once the display font is ready, so a
  // fallback face never shows up in the city.
  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    const lines = copy.split("\n");
    const paint = (family?: string) => {
      ctx.fillStyle = palette.night;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      layout.boards.forEach((board, i) => {
        const rect = atlas.rects[i];
        drawBoard(ctx, rect, board.color);
        const text = lines[i];
        if (family && text) drawCopy(ctx, rect, board, text, family);
      });
      texture.needsUpdate = true;
      invalidate();
    };
    paint();
    const family = displayFamily();
    const fonts = document.fonts;
    Promise.all([fonts.ready, fonts.load(`${WEIGHT} 64px ${family}`, copy)])
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) paint(family);
      });
    return () => {
      cancelled = true;
    };
  }, [texture, atlas, layout, copy, invalidate]);

  const faces = useRef<InstancedMesh>(null);
  const parts = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    const color = new Color();
    const faceMesh = faces.current;
    if (faceMesh) {
      layout.boards.forEach((board, i) => {
        matrix.compose(
          position.set(board.x, board.y, board.z),
          rotation.setFromAxisAngle(Y_AXIS, board.yaw),
          scale.set(board.w, board.h, 1),
        );
        faceMesh.setMatrixAt(i, matrix);
      });
      faceMesh.instanceMatrix.needsUpdate = true;
    }
    const partMesh = parts.current;
    if (partMesh) {
      layout.parts.forEach((part, i) => {
        matrix.compose(
          position.set(part.x, part.y, part.z),
          rotation.setFromAxisAngle(Y_AXIS, part.yaw),
          scale.set(part.w, part.h, part.d),
        );
        partMesh.setMatrixAt(i, matrix);
        partMesh.setColorAt(i, color.set(part.color));
      });
      partMesh.instanceMatrix.needsUpdate = true;
      if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
    }
  }, [layout]);

  return (
    <group>
      <instancedMesh
        ref={faces}
        args={[geometry, undefined, layout.boards.length]}
        frustumCulled={false}
      >
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={billboardVertexShader}
          fragmentShader={billboardFragmentShader}
          fog
        />
      </instancedMesh>
      <instancedMesh ref={parts} args={[undefined, undefined, layout.parts.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.7} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}

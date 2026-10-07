"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  IcosahedronGeometry,
  NoColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRandom } from "@/features/hero/scene/world";
import type { QualityTier } from "@/features/hero/useQualityTier";
import type { StageTimeline } from "@/features/work/workTimeline";
import { fonts, forTier, toTexture } from "../../artCanvas";
import { paintSet } from "../../paintSet";
import type { Vec3 } from "../../frame";
import { night } from "../../nightState";
import { Boxes, type BoxItem } from "../../parts/Boxes";
import { beatP } from "../../timelineKeys";
import {
  SIGN_RED,
  apronSize,
  paintAlto,
  paintApron,
  paintBoom,
  paintBoothPanel,
  paintBoothWindow,
  paintCabinet,
  paintSign,
  paintTuft,
} from "../art/armySite";
import {
  APRON,
  APRON_OUTLINE,
  BOOM,
  BOOTH,
  CABINET,
  CABLE_RADIUS,
  JUNCTION,
  LEGS_X,
  SIGN,
  SITE_FRAME,
  apronHeight,
  barbedStrands,
  boomAngle,
  cablePaths,
  concertina,
  fencePickets,
  groundAt,
  hedgehogBeams,
  kerbStones,
  local,
  polygonDepth,
  scrub,
  stones,
  tufts,
} from "./siteLayout";

/**
 * Everything round the army's board (ArmySet mounts it): the ground, the
 * perimeter and the checkpoint, laid out by siteLayout.ts and painted
 * once by art/armySite.ts. Low on purpose, so the board stays the hero;
 * lit by the stop's sodium and violet lights like the car. The boom
 * lifts in the leave beat exactly as the old striped barrier did.
 */

type Art = {
  apron: CanvasTexture;
  surface: CanvasTexture;
  tuft: CanvasTexture;
  sign: CanvasTexture;
  boom: CanvasTexture;
  alto: CanvasTexture;
  panel: CanvasTexture;
  window: CanvasTexture;
  cabinet: CanvasTexture;
};

/** The apron as a height field over its box: only the cells in (or just round) its outline. */
function apronGeometry(step: number): BufferGeometry {
  const nx = Math.ceil((APRON.x1 - APRON.x0) / step);
  const nz = Math.ceil((APRON.z1 - APRON.z0) / step);
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let j = 0; j <= nz; j += 1) {
    for (let i = 0; i <= nx; i += 1) {
      const x = APRON.x0 + ((APRON.x1 - APRON.x0) * i) / nx;
      const z = APRON.z0 + ((APRON.z1 - APRON.z0) * j) / nz;
      positions.push(x, apronHeight(x, z), z);
      uvs.push((x - APRON.x0) / (APRON.x1 - APRON.x0), (APRON.z1 - z) / (APRON.z1 - APRON.z0));
    }
  }
  const index: number[] = [];
  const at = (i: number, j: number) => j * (nx + 1) + i;
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const x = APRON.x0 + ((APRON.x1 - APRON.x0) * (i + 0.5)) / nx;
      const z = APRON.z0 + ((APRON.z1 - APRON.z0) * (j + 0.5)) / nz;
      if (polygonDepth([x, z], APRON_OUTLINE) < -step) continue;
      // Counter-clockwise seen from above.
      index.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Three crossed cards, a metre wide and tall, standing on y = 0; normals up, so a tuft lights like the ground. */
function tuftGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  for (let k = 0; k < 3; k += 1) {
    const a = (k * Math.PI) / 3;
    const dx = Math.cos(a) * 0.5;
    const dz = Math.sin(a) * 0.5;
    const base = positions.length / 3;
    positions.push(-dx, 0, -dz, dx, 0, dz, dx, 1, dz, -dx, 1, -dz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let n = 0; n < 4; n += 1) normals.push(0, 1, 0);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

/**
 * A tabaiba: not one dome but a cushion of rosettes, a crown lobe over a
 * ring of lower ones (the bush's short candelabra branches each end in a
 * tuft of leaves), every lobe pushed in and out a little. Inside a unit
 * of about a metre, like the dome it replaced; darker underneath (its own
 * shade in the vertex colours), so it sits in the gravel instead of
 * floating on it like a faceted stone.
 */
function scrubGeometry(): BufferGeometry {
  const FLOOR = -0.3;
  const random = createRandom(19);
  const lobes: { c: Vec3; r: number }[] = [{ c: [0, 0.08, 0], r: 0.27 }];
  const ring = 6;
  for (let k = 0; k < ring; k += 1) {
    const a = (k / ring) * Math.PI * 2 + random() * 0.4;
    const d = 0.25 + random() * 0.06;
    const r = 0.18 + random() * 0.06;
    // Low enough that even its smallest push reaches the flat underside.
    lobes.push({ c: [Math.cos(a) * d, FLOOR + r * 0.8 * 0.84 - 0.02, Math.sin(a) * d], r });
  }
  for (let k = 0; k < 3; k += 1) {
    const a = random() * Math.PI * 2;
    lobes.push({ c: [Math.cos(a) * 0.12, 0.22 + random() * 0.05, Math.sin(a) * 0.12], r: 0.12 + random() * 0.04 });
  }
  const parts = lobes.map(({ c, r }) => {
    const lobe = new IcosahedronGeometry(1, 1);
    const position = lobe.getAttribute("position") as BufferAttribute;
    const pushes = new Map<string, number>();
    const v = new Vector3();
    const colors: number[] = [];
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!pushes.has(key)) pushes.set(key, 0.84 + random() * 0.3);
      // Flattened a little: a rosette is wider than it is tall.
      v.set(v.x * r, v.y * r * 0.8, v.z * r).multiplyScalar(pushes.get(key) as number).add(new Vector3(...c));
      // A flat underside on the ground, a little below where the dome's lay (placed with its centre 0.32 of its height up).
      v.y = Math.max(v.y, FLOOR) - 0.06;
      position.setXYZ(i, v.x, v.y, v.z);
      const shade = 0.42 + 0.58 * Math.min(1, Math.max(0, (v.y + 0.36) / 0.6));
      colors.push(shade, shade, shade);
    }
    lobe.setAttribute("color", new Float32BufferAttribute(colors, 3));
    lobe.deleteAttribute("uv");
    return lobe;
  });
  const geometry = mergeGeometries(parts) ?? new BufferGeometry();
  parts.forEach((part) => part.dispose());
  geometry.computeVertexNormals();
  return geometry;
}

/** The cables: one tube per path, merged into a single draw. */
function cableGeometry(): BufferGeometry {
  const tubes = cablePaths().map((path) => {
    const curve = new CatmullRomCurve3(path.map((p) => new Vector3(...p)), false, "centripetal");
    const segments = Math.max(8, Math.round(curve.getLength() * 7));
    return new TubeGeometry(curve, segments, CABLE_RADIUS, 5, false);
  });
  const merged = mergeGeometries(tubes) ?? new BufferGeometry();
  tubes.forEach((tube) => tube.dispose());
  return merged;
}

function wireGeometry(points: Vec3[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.flat(), 3));
  return geometry;
}

export function ArmySite({ tier, timeline, index }: { tier: QualityTier; timeline: StageTimeline; index: number }) {
  const high = tier === "high";
  const [art, setArt] = useState<Art | null>(null);

  useEffect(
    () =>
      paintSet(
        [`400 100px ${fonts.condensed()}`],
        index,
        () => (): Art => {
          const apron = paintApron(!high);
          const surface = new CanvasTexture(apron.surface);
          surface.colorSpace = NoColorSpace;
          surface.anisotropy = 8;
          return {
            apron: toTexture(apron.color, 8),
            surface,
            tuft: toTexture(paintTuft()),
            sign: toTexture(forTier(paintSign(), !high)),
            boom: toTexture(paintBoom()),
            alto: toTexture(paintAlto()),
            panel: toTexture(paintBoothPanel()),
            window: toTexture(paintBoothWindow()),
            cabinet: toTexture(paintCabinet()),
          };
        },
        setArt,
        (made) => Object.values(made).forEach((texture) => texture.dispose()),
      ),
    [high, index],
  );

  const geometries = useMemo(
    () => ({
      apron: apronGeometry(apronSize(!high).w > 1024 ? 0.2 : 0.4),
      tuft: tuftGeometry(),
      scrub: scrubGeometry(),
      cables: cableGeometry(),
      wire: high ? wireGeometry([...concertina(), ...barbedStrands()]) : null,
    }),
    [high],
  );
  useEffect(
    () => () => {
      geometries.apron.dispose();
      geometries.tuft.dispose();
      geometries.scrub.dispose();
      geometries.cables.dispose();
      geometries.wire?.dispose();
    },
    [geometries],
  );

  const items = useMemo(
    () => ({
      kerbs: kerbStones(),
      stones: stones(high ? 260 : 110),
      tufts: tufts(high ? 90 : 40),
      scrub: scrub(high ? 18 : 10),
      pickets: fencePickets(),
      hedgehogs: hedgehogBeams(),
      junctions: LEGS_X.map<BoxItem>((x) => {
        const p = local(x + JUNCTION.x, JUNCTION.z, JUNCTION.y);
        return { p, s: JUNCTION.size, r: [0, SITE_FRAME.yaw, 0] };
      }),
    }),
    [high],
  );

  const boom = useRef<Group>(null);
  const leave = useMemo(() => ({ from: beatP(timeline, "army.leave"), to: beatP(timeline, "army.leave", 1) }), [timeline]);
  useFrame(() => {
    if (night.stop !== index || !boom.current) return;
    boom.current.rotation.x = boomAngle(night.p, leave);
  });

  const signGround = groundAt(SIGN.at[0], SIGN.at[1]);
  const cabinetGround = groundAt(CABINET.at[0], CABINET.at[2]);
  const S = BOOTH.size;
  const sill = 1.14;
  const head = 1.92;

  return (
    <group>
      {/* The apron: packed dirt and gravel, rutted, damp in places. */}
      {art ? (
        <mesh geometry={geometries.apron}>
          <meshStandardMaterial
            map={art.apron}
            roughnessMap={art.surface}
            bumpMap={art.surface}
            bumpScale={0.45}
            roughness={1}
            alphaTest={0.5}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
      <Boxes items={items.kerbs}>
        <meshStandardMaterial roughness={0.85} />
      </Boxes>
      <Boxes items={items.stones} geometry={<dodecahedronGeometry args={[0.5, 0]} />}>
        <meshStandardMaterial roughness={0.9} flatShading />
      </Boxes>
      {art ? (
        <Boxes items={items.tufts} geometry={<primitive object={geometries.tuft} attach="geometry" />}>
          <meshStandardMaterial map={art.tuft} alphaTest={0.5} side={DoubleSide} roughness={1} />
        </Boxes>
      ) : null}
      <Boxes items={items.scrub} geometry={<primitive object={geometries.scrub} attach="geometry" />}>
        <meshStandardMaterial roughness={0.95} flatShading vertexColors />
      </Boxes>

      {/* Floodlight cables from the cabinet to the legs, and the junction box each climbs into. */}
      <mesh geometry={geometries.cables}>
        <meshStandardMaterial color="#1d1a22" roughness={0.45} />
      </mesh>
      <Boxes items={items.junctions}>
        <meshStandardMaterial color="#7d7b84" roughness={0.6} metalness={0.3} />
      </Boxes>
      <group position={[CABINET.at[0], cabinetGround, CABINET.at[2]]} rotation-y={CABINET.yaw}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.8, 0.12, 0.46]} />
          <meshStandardMaterial color="#7a7380" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.12 + CABINET.size[1] / 2, 0]}>
          <boxGeometry args={CABINET.size as unknown as [number, number, number]} />
          <meshStandardMaterial color="#86858c" roughness={0.55} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.12 + CABINET.size[1] + 0.02, 0.01]}>
          <boxGeometry args={[CABINET.size[0] + 0.06, 0.04, CABINET.size[2] + 0.06]} />
          <meshStandardMaterial color="#6f6e76" roughness={0.5} metalness={0.4} />
        </mesh>
        {art ? (
          <mesh position={[0, 0.12 + CABINET.size[1] / 2, CABINET.size[2] / 2 + 0.003]}>
            <planeGeometry args={[CABINET.size[0] - 0.04, CABINET.size[1] - 0.04]} />
            <meshStandardMaterial map={art.cabinet} roughness={0.55} metalness={0.3} />
          </mesh>
        ) : null}
      </group>

      {/* The perimeter: pickets and wire behind the board, hedgehogs far left, the warning sign by the road. */}
      <Boxes items={items.pickets}>
        <meshStandardMaterial color="#4f4c44" roughness={0.6} metalness={0.4} />
      </Boxes>
      {geometries.wire ? (
        <lineSegments geometry={geometries.wire}>
          <lineBasicMaterial color="#4a4256" fog />
        </lineSegments>
      ) : null}
      <Boxes items={items.hedgehogs}>
        <meshStandardMaterial roughness={0.65} metalness={0.45} />
      </Boxes>
      <group position={[SIGN.at[0], signGround, SIGN.at[1]]} rotation-y={SIGN.yaw}>
        <mesh position={[0, SIGN.post / 2 - 0.2, 0]}>
          <boxGeometry args={[0.06, SIGN.post + 0.4, 0.06]} />
          <meshStandardMaterial color="#6d6a72" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, SIGN.bottom + SIGN.plate[1] / 2, 0.042]}>
          <boxGeometry args={[SIGN.plate[0], SIGN.plate[1], 0.02]} />
          <meshStandardMaterial color="#9a98a0" roughness={0.45} metalness={0.5} />
        </mesh>
        {art ? (
          <mesh position={[0, SIGN.bottom + SIGN.plate[1] / 2, 0.0535]}>
            <planeGeometry args={[SIGN.plate[0] - 0.004, SIGN.plate[1] - 0.004]} />
            <meshStandardMaterial map={art.sign} roughness={0.5} />
          </mesh>
        ) : null}
      </group>

      {/* The checkpoint: the boom on its post with its counterweight, its rest fork, the sentry box. */}
      <mesh position={[BOOM.post[0], 0.62, BOOM.post[1]]}>
        <boxGeometry args={[0.16, 1.24, 0.16]} />
        <meshStandardMaterial color="#4c4954" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[BOOM.post[0], 1.26, BOOM.post[1]]}>
        <boxGeometry args={[0.2, 0.04, 0.2]} />
        <meshStandardMaterial color="#3d3a44" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[BOOM.post[0], 0.015, BOOM.post[1]]}>
        <boxGeometry args={[0.34, 0.03, 0.34]} />
        <meshStandardMaterial color="#3d3a44" roughness={0.6} metalness={0.4} />
      </mesh>
      {art ? (
        <mesh position={[BOOM.rest[0], 0.47, BOOM.rest[1]]}>
          <cylinderGeometry args={[0.04, 0.045, 0.94, 10]} />
          <meshStandardMaterial map={art.boom} roughness={0.45} />
        </mesh>
      ) : null}
      {[-0.068, 0.068].map((dx) => (
        <mesh key={dx} position={[BOOM.rest[0] + dx, 1.0, BOOM.rest[1]]}>
          <boxGeometry args={[0.024, 0.16, 0.05]} />
          <meshStandardMaterial color="#3d3a44" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[BOOM.rest[0], 0.94, BOOM.rest[1]]}>
        <boxGeometry args={[0.16, 0.02, 0.05]} />
        <meshStandardMaterial color="#3d3a44" roughness={0.5} metalness={0.5} />
      </mesh>
      <group ref={boom} position={BOOM.pivot}>
        {art ? (
          <mesh position={[0, 0, -BOOM.reach / 2]} rotation-x={-Math.PI / 2}>
            <cylinderGeometry args={[BOOM.tube, BOOM.tube, BOOM.reach, 12, 1]} />
            <meshStandardMaterial map={art.boom} roughness={0.4} emissive="#ffffff" emissiveMap={art.boom} emissiveIntensity={0.07} />
          </mesh>
        ) : null}
        <mesh position={[0, 0, -BOOM.reach - 0.03]} rotation-x={-Math.PI / 2}>
          <cylinderGeometry args={[BOOM.tube + 0.006, BOOM.tube + 0.006, 0.06, 12, 1]} />
          <meshStandardMaterial color="#1f1b22" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, BOOM.tail / 2]}>
          <boxGeometry args={[0.08, 0.08, BOOM.tail]} />
          <meshStandardMaterial color="#55525c" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.02, BOOM.tail - 0.2]}>
          <boxGeometry args={[0.2, 0.26, 0.38]} />
          <meshStandardMaterial color="#47444d" roughness={0.75} metalness={0.2} />
        </mesh>
        <mesh position={[0.075, 0, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 14]} />
          <meshStandardMaterial color="#3a3740" roughness={0.45} metalness={0.6} />
        </mesh>
        {/* The ALTO disc, on two short links under the arm. */}
        {[-0.12, 0.12].map((dz) => (
          <mesh key={dz} position={[0, -BOOM.tube - 0.04, -0.9 + dz]}>
            <boxGeometry args={[0.012, 0.08, 0.012]} />
            <meshStandardMaterial color="#3d3a44" roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
        {art
          ? [1, -1].map((side) => (
              <mesh key={side} position={[side * 0.005, -BOOM.tube - 0.3, -0.9]} rotation-y={(side * Math.PI) / 2 + Math.PI}>
                <circleGeometry args={[0.22, 28]} />
                <meshStandardMaterial map={art.alto} roughness={0.4} emissive="#ffffff" emissiveMap={art.alto} emissiveIntensity={0.06} />
              </mesh>
            ))
          : null}
      </group>

      <group position={[BOOTH.at[0], 0, BOOTH.at[1]]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[S + 0.16, 0.14, S + 0.16]} />
          <meshStandardMaterial color="#7a7380" roughness={0.95} />
        </mesh>
        {/* Lower panels on the three windowed sides; the door side is panel and door to the eaves. */}
        {art
          ? (
              [
                [0, -S / 2 + 0.025, 0],
                [-S / 2 + 0.025, 0, Math.PI / 2],
                [S / 2 - 0.025, 0, Math.PI / 2],
              ] as const
            ).map(([x, z, ry], i) => (
              <mesh key={i} position={[x, 0.14 + (sill - 0.14) / 2, z]} rotation-y={ry}>
                <boxGeometry args={[S, sill - 0.14, 0.05]} />
                <meshStandardMaterial map={art.panel} roughness={0.7} />
              </mesh>
            ))
          : null}
        {art ? (
          <mesh position={[-S / 2 + 0.24, 0.14 + (BOOTH.eaves - 0.14) / 2, S / 2 - 0.025]}>
            <boxGeometry args={[0.48, BOOTH.eaves - 0.14, 0.05]} />
            <meshStandardMaterial map={art.panel} roughness={0.7} />
          </mesh>
        ) : null}
        <mesh position={[0.24, 0.14 + 0.92, S / 2 - 0.02]}>
          <boxGeometry args={[0.8, 1.84, 0.05]} />
          <meshStandardMaterial color="#555c3c" roughness={0.6} />
        </mesh>
        <mesh position={[0.5, 1.02, S / 2 + 0.02]}>
          <boxGeometry args={[0.04, 0.12, 0.04]} />
          <meshStandardMaterial color="#c8c2b4" roughness={0.3} metalness={0.8} />
        </mesh>
        {art ? (
          <mesh position={[0.24, 1.52, S / 2 + 0.006]}>
            <planeGeometry args={[0.42, 0.38]} />
            <meshBasicMaterial map={art.window} color="#a89a88" toneMapped />
          </mesh>
        ) : null}
        {/* The window band: corner posts, the lit panes a little in, sill and head. */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (S - 0.08)) / 2, sill + (head - sill) / 2, (sz * (S - 0.08)) / 2]}>
            <boxGeometry args={[0.08, head - sill, 0.08]} />
            <meshStandardMaterial color="#9a8c66" roughness={0.6} />
          </mesh>
        ))}
        {art
          ? (
              [
                [0, -S / 2 + 0.04, Math.PI],
                [-S / 2 + 0.04, 0, -Math.PI / 2],
                [S / 2 - 0.04, 0, Math.PI / 2],
              ] as const
            ).map(([x, z, ry], i) => (
              <mesh key={i} position={[x, sill + (head - sill) / 2, z]} rotation-y={ry}>
                <planeGeometry args={[S - 0.16, head - sill]} />
                <meshBasicMaterial map={art.window} color="#a89a88" toneMapped />
              </mesh>
            ))
          : null}
        {(
          [
            [0, -S / 2, 0],
            [-S / 2, 0, Math.PI / 2],
            [S / 2, 0, Math.PI / 2],
          ] as const
        ).map(([x, z, ry], i) => (
          <group key={i} position={[x, 0, z]} rotation-y={ry}>
            <mesh position={[0, sill + 0.02, 0]}>
              <boxGeometry args={[S + 0.04, 0.04, 0.12]} />
              <meshStandardMaterial color="#8e8264" roughness={0.6} />
            </mesh>
            <mesh position={[0, head + 0.02, 0]}>
              <boxGeometry args={[S, 0.04, 0.08]} />
              <meshStandardMaterial color="#8e8264" roughness={0.6} />
            </mesh>
            <mesh position={[0, sill + (head - sill) / 2, 0]}>
              <boxGeometry args={[0.03, head - sill, 0.05]} />
              <meshStandardMaterial color="#8e8264" roughness={0.6} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, head + (BOOTH.eaves - head) / 2 + 0.02, 0]}>
          <boxGeometry args={[S, BOOTH.eaves - head - 0.04, S]} />
          <meshStandardMaterial color="#b4a47c" roughness={0.7} />
        </mesh>
        <mesh position={[0, BOOTH.eaves + 0.03, 0]}>
          <boxGeometry args={[S + 0.34, 0.06, S + 0.34]} />
          <meshStandardMaterial color="#3e4432" roughness={0.7} />
        </mesh>
        <mesh position={[0, BOOTH.eaves + 0.06 + BOOTH.roof / 2, 0]} rotation-y={Math.PI / 4}>
          <coneGeometry args={[((S + 0.34) / 2) * Math.SQRT2, BOOTH.roof, 4, 1]} />
          <meshStandardMaterial color="#454d36" roughness={0.65} flatShading />
        </mesh>
        <mesh position={[0, BOOTH.eaves + 0.06 + BOOTH.roof + 0.06, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.14, 8]} />
          <meshStandardMaterial color="#3a3a36" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, BOOTH.eaves - 0.05, -S / 2 - 0.02]}>
          <boxGeometry args={[0.5, 0.06, 0.02]} />
          <meshStandardMaterial color={SIGN_RED} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

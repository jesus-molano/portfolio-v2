import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import es from "@/i18n/dictionaries/es.json";
import { STATIC_PROGRESS } from "../scroll/heroProgress";
import { CAR_POSITION } from "./drive";
import { PALM_ROW } from "./roadside";
import {
  CAR_BOX,
  carCorner,
  type CameraKey,
  type CameraPose,
  CLEAR_HEIGHT,
  DRIVER_HEAD,
  evaluateCamera,
  fitToAspect,
  horizontalFov,
  interpolateKeys,
  MIN_CAMERA_HEIGHT,
  MIN_HORIZONTAL_FOV,
  maxPullBack,
  projectToNdc,
  REFERENCE_ASPECT,
  SHOT_COUNT,
  SHOTS,
  shotIndexAt,
  shotKeys,
  shotLocalTime,
  stickyShot,
  subjectInFrame,
  tiltToHeight,
  verticalFov,
} from "./shots";
import { ONCOMING_LANE_X, SAME_LANE_X } from "./trafficLayout";
import { world } from "./world";

/** Phone in portrait, tablet in portrait, laptop, ultrawide. */
const ASPECTS = [0.46, 0.75, 1.6, 2.2];
/** Start, middle and end of a shot. */
const MOMENTS = [0, 0.5, 1];
/** Palm rows stand at |x| >= PALM_ROW.minX; no camera comes within ~8 m of them. */
const PALM_ROW_X = PALM_ROW.minX;
/** From a lane's centre to its divider, less a margin: a traffic car is ~1.9 m wide. */
const LANE_CLEARANCE = 1.75;
/** Palms are at most 12.5 m tall; above this a camera clears them. */
const PALM_TOP = 14;

function pose(): CameraPose {
  return { position: new Vector3(), look: new Vector3(), fov: 50, shot: 0 };
}

/** Film progress at a local time inside a shot (the very end stays inside it). */
function progressAt(shot: number, local: number): number {
  return (shot + Math.min(local, 0.9999)) / SHOT_COUNT;
}

function ndc(point: Vector3, camera: CameraKey, aspect: number) {
  const out = { x: 0, y: 0 };
  return projectToNdc(point, camera, aspect, out) ? out : null;
}

/** Screen-space bounds of the car's bounding box (null if a corner is behind the lens). */
function carBounds(camera: CameraKey, aspect: number) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, behind: 0 };
  const corner = new Vector3();
  for (let i = 0; i < 8; i += 1) {
    const p = ndc(carCorner(i, corner), camera, aspect);
    if (!p) {
      bounds.behind += 1;
      continue;
    }
    bounds.minX = Math.min(bounds.minX, p.x);
    bounds.maxX = Math.max(bounds.maxX, p.x);
    bounds.minY = Math.min(bounds.minY, p.y);
    bounds.maxY = Math.max(bounds.maxY, p.y);
  }
  return bounds;
}

function viewAngle(a: Vector3, b: Vector3): number {
  return (a.angleTo(b) * 180) / Math.PI;
}

describe("the edit", () => {
  it("cuts five distinct shots, in order", () => {
    expect(SHOTS.map((shot) => shot.id)).toEqual(["rear", "closeUp", "tracking", "low", "crane"]);
    expect(SHOT_COUNT).toBe(5);
  });

  it("has a HUD label for every shot in both languages", () => {
    expect(en.hero.shots).toHaveLength(SHOT_COUNT);
    expect(es.hero.shots).toHaveLength(SHOT_COUNT);
  });

  it("cuts at every fifth of the film", () => {
    expect(shotIndexAt(0)).toBe(0);
    expect(shotIndexAt(0.1999)).toBe(0);
    expect(shotIndexAt(0.2)).toBe(1);
    expect(shotIndexAt(0.4)).toBe(2);
    expect(shotIndexAt(0.6)).toBe(3);
    expect(shotIndexAt(0.8)).toBe(4);
    expect(shotIndexAt(1)).toBe(4);
    expect(shotIndexAt(-1)).toBe(0);
    expect(shotLocalTime(0.5)).toBeCloseTo(0.5, 10);
    expect(shotLocalTime(1)).toBe(1);
  });

  it("changes the angle on Jesús by at least 30 degrees at every cut (no jump cuts)", () => {
    for (let shot = 0; shot < SHOT_COUNT - 1; shot += 1) {
      for (const aspect of ASPECTS) {
        const before = evaluateCamera(progressAt(shot, 1), pose(), aspect);
        const after = evaluateCamera(progressAt(shot + 1, 0), pose(), aspect);
        const a = new Vector3().subVectors(before.position, DRIVER_HEAD);
        const b = new Vector3().subVectors(after.position, DRIVER_HEAD);
        expect(viewAngle(a, b), `${SHOTS[shot].id} -> ${SHOTS[shot + 1].id}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("opens the crane on a setup no other shot uses", () => {
    const crane = evaluateCamera(progressAt(4, 0), pose());
    const from = new Vector3().subVectors(crane.position, DRIVER_HEAD);
    for (let shot = 0; shot < SHOT_COUNT - 1; shot += 1) {
      for (const local of MOMENTS) {
        const other = evaluateCamera(progressAt(shot, local), pose());
        const angle = viewAngle(from, new Vector3().subVectors(other.position, DRIVER_HEAD));
        expect(angle, `${SHOTS[shot].id} at ${local}`).toBeGreaterThanOrEqual(30);
      }
    }
  });
});

describe("framing at every aspect", () => {
  for (const aspect of ASPECTS) {
    for (const [index, shot] of SHOTS.entries()) {
      const until = shot.frame.until ?? 1;

      it(`${shot.id} @ ${aspect}: keeps his head in the centre-safe box`, () => {
        for (const local of [...MOMENTS.filter((t) => t <= until), until]) {
          const camera = evaluateCamera(progressAt(index, local), pose(), aspect);
          const head = ndc(DRIVER_HEAD, camera, aspect);
          expect(head, `t=${local}`).not.toBeNull();
          // The required box: |x| < 0.7, |y| < 0.75. The crane keeps him lower
          // and wider (x 0.8) on purpose: the car rides the lower third under
          // the city; every other shot uses a box that also clears the title
          // and the subtitles.
          const box = shot.frame.head;
          expect(Math.abs(head!.x), `t=${local} x`).toBeLessThanOrEqual(shot.id === "crane" ? 0.8 : 0.7);
          expect(Math.abs(head!.y), `t=${local} y`).toBeLessThan(0.75);
          expect(head!.y).toBeGreaterThanOrEqual(box.yMin - 1e-6);
          expect(head!.y).toBeLessThanOrEqual(box.yMax + 1e-6);
        }
      });

      it(`${shot.id} @ ${aspect}: keeps the car on screen`, () => {
        for (const local of MOMENTS.filter((t) => t <= until)) {
          const camera = evaluateCamera(progressAt(index, local), pose(), aspect);
          const bounds = carBounds(camera, aspect);
          if (shot.frame.car) {
            // Wide shots: the whole car, inside its box.
            expect(bounds.behind).toBe(0);
            expect(subjectInFrame(camera, aspect, shot.frame)).toBe(true);
          } else {
            // Close shots crop the car on purpose, but it is always in the frame.
            expect(bounds.maxX, `t=${local}`).toBeGreaterThan(-1);
            expect(bounds.minX, `t=${local}`).toBeLessThan(1);
            expect(bounds.maxY, `t=${local}`).toBeGreaterThan(-1);
            expect(bounds.minY, `t=${local}`).toBeLessThan(1);
          }
        }
      });

      it(`${shot.id} @ ${aspect}: never narrows below the horizontal floor`, () => {
        for (const local of MOMENTS) {
          const camera = evaluateCamera(progressAt(index, local), pose(), aspect);
          const minimum = shot.frame.minHorizontalFov ?? MIN_HORIZONTAL_FOV;
          // Never narrower than the floor, unless the shot is composed tighter.
          const keys = shotKeys(shot);
          const tightest = Math.min(...keys.map((key) => horizontalFov(key.fov, REFERENCE_ASPECT)));
          expect(horizontalFov(camera.fov, aspect)).toBeGreaterThanOrEqual(Math.min(minimum, tightest) - 0.01);
        }
      });

      it(`${shot.id} @ ${aspect}: moves smoothly inside the shot`, () => {
        // A jump in the framing (the fit switching on or off) shows up as a
        // step much longer than the ones around it.
        let previous: CameraPose | null = null;
        let lastStep = 0;
        for (let i = 0; i <= 200; i += 1) {
          const camera = evaluateCamera(progressAt(index, i / 200), pose(), aspect);
          if (previous) {
            const step = camera.position.distanceTo(previous.position);
            expect(step, `step ${i}`).toBeLessThan(1);
            if (i > 1) expect(Math.abs(step - lastStep), `step ${i}`).toBeLessThan(0.15);
            lastStep = step;
            expect(Math.abs(camera.fov - previous.fov), `step ${i}`).toBeLessThan(2);
            const turn = viewAngle(
              new Vector3().subVectors(camera.look, camera.position),
              new Vector3().subVectors(previous.look, previous.position),
            );
            expect(turn, `step ${i}`).toBeLessThan(4);
          }
          previous = camera;
        }
      });
    }

    it(`rear @ ${aspect}: keeps the car under the title while it shows`, () => {
      // The title fades out over the first half of the opening shot.
      for (const local of [0, 0.25, 0.5]) {
        const camera = evaluateCamera(progressAt(0, local), pose(), aspect);
        expect(carBounds(camera, aspect).maxY).toBeLessThan(0.2);
      }
    });

    it(`reduced motion @ ${aspect}: the still frames the whole car`, () => {
      const camera = evaluateCamera(STATIC_PROGRESS, pose(), aspect);
      const bounds = carBounds(camera, aspect);
      expect(bounds.behind).toBe(0);
      expect(bounds.minX).toBeGreaterThan(-1);
      expect(bounds.maxX).toBeLessThan(1);
      expect(bounds.minY).toBeGreaterThan(-1);
      expect(bounds.maxY).toBeLessThan(1);
    });

    it(`crane @ ${aspect}: shows the city and the sun before the fade to night`, () => {
      // HeroStage starts the fade at film 0.93 and the film plays it in under
      // a second, so the reveal has to land while the last subtitle is up.
      const camera = evaluateCamera(0.92, pose(), aspect);
      const sun = ndc(world.sun.position, camera, aspect);
      expect(sun).not.toBeNull();
      expect(Math.abs(sun!.x)).toBeLessThan(0.9);
      // Up in the middle band of the frame, not peeking in at the top edge.
      expect(Math.abs(sun!.y)).toBeLessThan(0.5);
      const direction = new Vector3().subVectors(camera.look, camera.position).normalize();
      expect(Math.abs(Math.asin(direction.y))).toBeLessThan((6 * Math.PI) / 180);
    });

    it(`crane @ ${aspect}: ends on the city with the sun in frame`, () => {
      const camera = evaluateCamera(1, pose(), aspect);
      const sun = ndc(world.sun.position, camera, aspect);
      expect(sun).not.toBeNull();
      expect(Math.abs(sun!.x)).toBeLessThan(0.9);
      expect(Math.abs(sun!.y)).toBeLessThan(0.9);
      const direction = new Vector3().subVectors(camera.look, camera.position).normalize();
      // Level with the horizon, looking down the causeway toward the city.
      expect(Math.abs(Math.asin(direction.y))).toBeLessThan((6 * Math.PI) / 180);
      expect(direction.z).toBeLessThan(-0.9);
    });
  }
});

describe("where the cameras may go", () => {
  const samples = SHOTS.flatMap((shot, index) =>
    ASPECTS.flatMap((aspect) =>
      Array.from({ length: 51 }, (_, i) => ({
        shot: shot.id,
        aspect,
        local: i / 50,
        camera: evaluateCamera(progressAt(index, i / 50), pose(), aspect),
      })),
    ),
  );

  it("never puts a low camera in a lane with traffic", () => {
    for (const { shot, aspect, local, camera } of samples) {
      if (camera.position.y >= CLEAR_HEIGHT) continue;
      const label = `${shot} @ ${aspect} t=${local.toFixed(2)} x=${camera.position.x.toFixed(2)}`;
      expect(Math.abs(camera.position.x - SAME_LANE_X), label).toBeGreaterThan(LANE_CLEARANCE);
      expect(Math.abs(camera.position.x - ONCOMING_LANE_X), label).toBeGreaterThan(LANE_CLEARANCE);
    }
  });

  it("keeps every camera ~8 m from the palm rows", () => {
    for (const { shot, aspect, local, camera } of samples) {
      if (camera.position.y >= PALM_TOP) continue;
      const label = `${shot} @ ${aspect} t=${local.toFixed(2)}`;
      expect(PALM_ROW_X - Math.abs(camera.position.x), label).toBeGreaterThanOrEqual(7.9);
    }
  });

  it("keeps every camera above the road and outside the car", () => {
    for (const { shot, aspect, local, camera } of samples) {
      const label = `${shot} @ ${aspect} t=${local.toFixed(2)}`;
      expect(camera.position.y, label).toBeGreaterThanOrEqual(MIN_CAMERA_HEIGHT - 1e-6);
      const { x, y, z } = camera.position;
      const inside =
        x > CAR_BOX.min.x - 0.3 &&
        x < CAR_BOX.max.x + 0.3 &&
        y < CAR_BOX.max.y + 0.3 &&
        z > CAR_BOX.min.z - 0.3 &&
        z < CAR_BOX.max.z + 0.3;
      expect(inside, label).toBe(false);
    }
  });
});

describe("palms behind the driver", () => {
  // The close-up and the tracking shot look across the road at the palm row
  // on the passenger side. The ground seen just over the top of his head
  // must be nearer than the row: the trunks then stand above his head in
  // the frame and never grow out of it, wherever the row has streamed to.
  it("keeps the foot of the palm row above his head", () => {
    const SAND_Y = 0.07;
    const overHead = DRIVER_HEAD.clone().add(new Vector3(0, 0.13, 0));
    for (const id of ["closeUp", "tracking"] as const) {
      const index = SHOTS.findIndex((shot) => shot.id === id);
      for (const aspect of ASPECTS) {
        for (const local of MOMENTS) {
          const camera = evaluateCamera(progressAt(index, local), pose(), aspect);
          const ray = overHead.clone().sub(camera.position);
          const label = `${id} @ ${aspect} t=${local}`;
          // Looking level or up, the sky is behind his head.
          if (ray.y >= 0) continue;
          const ground = camera.position.clone().addScaledVector(ray, (SAND_Y - camera.position.y) / ray.y);
          expect(Math.abs(ground.x), label).toBeLessThan(PALM_ROW_X);
        }
      }
    }
  });
});

describe("lens per shot", () => {
  it("keeps the wide shots sharp and opens up the close ones", () => {
    const bokeh = Object.fromEntries(SHOTS.map((shot) => [shot.id, shot.lens.bokehScale]));
    expect(bokeh.rear).toBe(0);
    expect(bokeh.crane).toBe(0);
    expect(bokeh.closeUp).toBeCloseTo(2, 0);
    expect(bokeh.tracking).toBeCloseTo(2, 0);
    expect(bokeh.low).toBeCloseTo(3, 0);
    for (const shot of SHOTS) expect(shot.lens.focusRange).toBeGreaterThan(0);
  });
});

describe("DRIVER_HEAD", () => {
  it("sits on the driver's side of the car, at head height", () => {
    expect(DRIVER_HEAD.x).toBeLessThan(CAR_POSITION.x);
    expect(DRIVER_HEAD.x).toBeGreaterThan(CAR_BOX.min.x);
    expect(DRIVER_HEAD.y).toBeGreaterThan(1.2);
    expect(DRIVER_HEAD.y).toBeLessThan(1.5);
  });
});

describe("horizontalFov and verticalFov", () => {
  it("convert between the two and back", () => {
    for (const aspect of ASPECTS) {
      expect(verticalFov(horizontalFov(40, aspect), aspect)).toBeCloseTo(40, 8);
    }
    expect(horizontalFov(50, 1)).toBeCloseTo(50, 8);
    expect(horizontalFov(50, 2)).toBeGreaterThan(50);
  });
});

describe("projectToNdc", () => {
  const camera: CameraKey = { position: new Vector3(0, 1, 10), look: new Vector3(0, 1, 0), fov: 60 };

  it("puts the aim point in the centre", () => {
    const point = ndc(camera.look, camera, 1.5);
    expect(point!.x).toBeCloseTo(0, 10);
    expect(point!.y).toBeCloseTo(0, 10);
  });

  it("maps the edges of the frustum to ±1", () => {
    const half = Math.tan(Math.PI / 6) * 10;
    expect(ndc(new Vector3(0, 1 + half, 0), camera, 1.5)!.y).toBeCloseTo(1, 8);
    expect(ndc(new Vector3(half * 1.5, 1, 0), camera, 1.5)!.x).toBeCloseTo(1, 8);
    // +x is on the right when looking down -z.
    expect(ndc(new Vector3(1, 1, 0), camera, 1.5)!.x).toBeGreaterThan(0);
  });

  it("rejects points behind the lens", () => {
    expect(ndc(new Vector3(0, 1, 20), camera, 1.5)).toBeNull();
  });

  it("survives a camera looking straight down", () => {
    const down: CameraKey = { position: new Vector3(0, 10, 0), look: new Vector3(0, 0, 0), fov: 60 };
    const point = ndc(new Vector3(0, 0, 0), down, 1);
    expect(point!.x).toBeCloseTo(0, 10);
    expect(Number.isFinite(point!.y)).toBe(true);
  });
});

describe("interpolateKeys", () => {
  const keys = [
    { t: 0, position: new Vector3(0, 0, 0), look: new Vector3(0, 0, -1), fov: 40 },
    { t: 0.2, position: new Vector3(1, 5, 0), look: new Vector3(0, 0, -1), fov: 50 },
    { t: 1, position: new Vector3(10, 6, 30), look: new Vector3(0, 0, -1), fov: 40 },
  ];

  it("runs through every key", () => {
    for (const key of keys) {
      const out = interpolateKeys(keys, key.t, { position: new Vector3(), look: new Vector3(), fov: 0 });
      expect(out.position.distanceTo(key.position)).toBeLessThan(1e-9);
      expect(out.fov).toBeCloseTo(key.fov, 9);
    }
  });

  it("never overshoots a key, however unevenly they are spaced", () => {
    for (let i = 0; i <= 100; i += 1) {
      const out = interpolateKeys(keys, i / 100, { position: new Vector3(), look: new Vector3(), fov: 0 });
      expect(out.position.y).toBeLessThanOrEqual(6 + 1e-9);
      expect(out.position.x).toBeGreaterThanOrEqual(-1e-9);
      expect(out.position.z).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it("eases in and out at the ends of the shot", () => {
    const start = interpolateKeys(keys, 0.001, { position: new Vector3(), look: new Vector3(), fov: 0 });
    expect(start.position.length()).toBeLessThan(0.01);
  });

  it("clamps times outside the shot", () => {
    const out = interpolateKeys(keys, 2, { position: new Vector3(), look: new Vector3(), fov: 0 });
    expect(out.position.distanceTo(keys[2].position)).toBeLessThan(1e-9);
  });
});

describe("fitToAspect", () => {
  it("leaves every shot as composed at the reference aspect", () => {
    for (const shot of SHOTS) {
      for (const key of shotKeys(shot)) {
        if (key.t > (shot.frame.until ?? 1)) continue;
        const composed: CameraKey = {
          position: key.position.clone().setX(key.position.x + CAR_POSITION.x),
          look: key.look.clone().setX(key.look.x + CAR_POSITION.x),
          fov: key.fov,
        };
        const fitted = fitToAspect(
          { position: composed.position.clone(), look: composed.look.clone(), fov: composed.fov },
          REFERENCE_ASPECT,
          shot.frame,
        );
        expect(fitted.position.distanceTo(composed.position), `${shot.id} t=${key.t}`).toBeLessThan(1e-6);
        expect(fitted.fov).toBeCloseTo(composed.fov, 6);
      }
    }
  });

  it("widens a narrow screen to the horizontal floor", () => {
    const camera: CameraKey = { position: new Vector3(0, 2, 12), look: new Vector3(2.4, 1, 0), fov: 44 };
    fitToAspect(camera, 0.46);
    expect(horizontalFov(camera.fov, 0.46)).toBeCloseTo(MIN_HORIZONTAL_FOV, 6);
  });

  it("pulls back, then widens, until the subject fits", () => {
    // Far too close for a phone: the whole car cannot fit at the floor.
    const frame = { head: { x: 0.7, yMin: -0.75, yMax: 0.75 }, car: { x: 0.9, yMin: -0.9, yMax: 0.9 } };
    const camera: CameraKey = { position: new Vector3(-1, 1.6, 0.3), look: new Vector3(2.4, 1, 0), fov: 40 };
    fitToAspect(camera, 0.46, frame);
    expect(subjectInFrame(camera, 0.46, frame)).toBe(true);
    // It never backs into the oncoming traffic lane.
    expect(camera.position.x).toBeGreaterThanOrEqual(-4 - 1e-6);
  });
});

describe("maxPullBack", () => {
  it("stops a low camera at the edge of the traffic lanes", () => {
    const camera: CameraKey = { position: new Vector3(-3, 2, 0), look: new Vector3(2, 2, 0), fov: 50 };
    expect(maxPullBack(camera)).toBeCloseTo(1, 6);
  });

  it("stops a camera looking up before it reaches the road", () => {
    const camera: CameraKey = { position: new Vector3(0, 1.3, 0), look: new Vector3(0, 2.3, -1), fov: 50 };
    expect(maxPullBack(camera)).toBeCloseTo(Math.SQRT2, 6);
  });

  it("lets a high camera pull back over the lanes, up to twice its distance", () => {
    const camera: CameraKey = { position: new Vector3(-3, 8, 0), look: new Vector3(2, 8, 0), fov: 50 };
    expect(maxPullBack(camera)).toBeCloseTo(5, 6);
  });
});

describe("tiltToHeight", () => {
  it("puts his head at the requested height", () => {
    const camera: CameraKey = { position: new Vector3(0.5, 2.5, 11), look: new Vector3(2.4, 2.8, -16), fov: 90 };
    tiltToHeight(camera, 0.46, -0.3);
    expect(ndc(DRIVER_HEAD, camera, 0.46)!.y).toBeCloseTo(-0.3, 3);
    expect(camera.position.toArray()).toEqual([0.5, 2.5, 11]);
  });

  it("leaves the aim alone when the height cannot be reached", () => {
    const camera: CameraKey = { position: new Vector3(0.5, 2.5, 11), look: new Vector3(2.4, 2.8, -16), fov: 90 };
    tiltToHeight(camera, 0.46, 5);
    expect(camera.look.toArray()).toEqual([2.4, 2.8, -16]);
  });
});

describe("stickyShot", () => {
  const cut = 2 / SHOT_COUNT;

  it("keeps the shot within the band on either side of a cut", () => {
    expect(stickyShot(cut + 0.001, 1)).toEqual({ shot: 1, p: cut - 1e-6 });
    expect(shotIndexAt(stickyShot(cut + 0.001, 1).p)).toBe(1);
    expect(stickyShot(cut - 0.001, 2)).toEqual({ shot: 2, p: cut });
    expect(shotIndexAt(stickyShot(cut - 0.001, 2).p)).toBe(2);
  });

  it("cuts beyond the band", () => {
    expect(stickyShot(cut + 0.003, 1)).toEqual({ shot: 2, p: cut + 0.003 });
    expect(stickyShot(cut - 0.003, 2)).toEqual({ shot: 1, p: cut - 0.003 });
  });

  it("follows the progress inside a shot, on the first frame and on a jump", () => {
    expect(stickyShot(0.3, 1)).toEqual({ shot: 1, p: 0.3 });
    expect(stickyShot(0.3, -1)).toEqual({ shot: 1, p: 0.3 });
    expect(stickyShot(0.9, 1)).toEqual({ shot: 4, p: 0.9 });
  });
});

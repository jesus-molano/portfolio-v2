import type { CSSProperties } from "react";
import { palette } from "@/design/tokens";
import styles from "./Horizon.module.css";
import { buildHorizon, type HorizonLayout, LAYOUTS } from "./horizon";

/** A colour between two palette hexes: the in-between tones of the sky and the sea, made of tokens. */
export function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t));
  return `#${out.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const C = {
  night: palette.night,
  deep: mix(palette.night, palette.ink, 0.35),
  ink: palette.ink,
  dusk: palette.dusk,
  lilac: palette.lilac,
  haze: palette.haze,
  pink: palette.pink,
  magenta: palette.magenta,
  orange: palette.orange,
  amber: palette.amber,
  cream: palette.cream,
  sodium: palette.sodium,
  sodiumNight: palette.sodiumNight,
  moon: palette.moon,
  asphalt: palette.asphalt,
};

const style = (vars: Record<string, string | number>) => vars as CSSProperties;

/** A lamp's streak on the water as the swell breaks it: short strokes, narrowing and fading downward. */
function ripples(r: { x: number; y: number; width: number; height: number }) {
  const count = Math.max(3, Math.min(9, Math.round(r.height / 5)));
  const step = r.height / count;
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const w = r.width * (2.4 - t * 1.4) * (i % 2 ? 0.75 : 1.1);
    return {
      x: Math.round((r.x + r.width / 2 - w / 2 + (i % 3 === 1 ? r.width * 0.4 : 0)) * 10) / 10,
      y: Math.round((r.y + i * step) * 10) / 10,
      w: Math.round(w * 10) / 10,
      h: Math.round(Math.max(0.6, step * 0.45) * 10) / 10,
      o: Math.round((0.85 - t * 0.6) * 100) / 100,
    };
  });
}

/**
 * The start menu's picture (horizon.ts has the geometry and why): the
 * causeway at sunset under a pastel sky, drawn on the server in both
 * layouts; CSS shows the one for the screen (LoadingScreen.module.css), so
 * the first paint is already right. Decoration only (`aria-hidden`).
 *
 * What moves, all CSS on the drawing and none of it under reduced motion:
 * the sun sinks as the city loads (`--p` on the loading screen), the
 * causeway's lamps light one after another toward the city, the windows
 * come on once it is in; stars twinkle, the clouds drift, the sun's road
 * glitters on the water, the palms sway and a few birds cross the sky.
 */
export function Horizon() {
  return (
    <>
      <Scene layout={LAYOUTS.wide} />
      <Scene layout={LAYOUTS.tall} />
    </>
  );
}

function Scene({ layout }: { layout: HorizonLayout }) {
  const scene = buildHorizon(layout);
  const { width: W, height: H, horizon: hy, name } = layout;
  const id = (part: string) => `hz-${name}-${part}`;
  const url = (part: string) => `url(#${id(part)})`;
  const sun = layout.sun;

  return (
    <svg
      className={styles.scene}
      data-layout={name}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={name === "wide" ? "xMaxYMid slice" : "xMidYMin slice"}
      aria-hidden="true"
      focusable="false"
      style={style({ "--rise": `${layout.sunRise}px`, "--lamps": scene.lamps.length })}
    >
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.night} />
          <stop offset="0.22" stopColor={mix(C.night, C.dusk, 0.35)} />
          <stop offset="0.45" stopColor={mix(C.night, C.dusk, 0.8)} />
          <stop offset="0.64" stopColor={mix(C.dusk, C.lilac, 0.7)} />
          <stop offset="0.8" stopColor={mix(C.lilac, C.haze, 0.75)} />
          <stop offset="0.93" stopColor={mix(C.haze, C.orange, 0.5)} />
          <stop offset="1" stopColor={C.amber} />
        </linearGradient>
        <linearGradient id={id("sea")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(C.amber, C.pink, 0.6)} />
          <stop offset="0.06" stopColor={mix(C.haze, C.pink, 0.4)} />
          <stop offset="0.22" stopColor={mix(C.magenta, C.lilac, 0.55)} />
          <stop offset="0.5" stopColor={mix(C.ink, C.lilac, 0.45)} />
          <stop offset="0.78" stopColor={mix(C.night, C.ink, 0.6)} />
          <stop offset="1" stopColor={C.night} />
        </linearGradient>
        <linearGradient id={id("road")} x1="0" y1={hy} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          {/* Wet asphalt: the sky's pink far away, the night near. */}
          <stop offset="0" stopColor={mix(C.haze, C.lilac, 0.4)} />
          <stop offset="0.12" stopColor={mix(C.lilac, C.asphalt, 0.55)} />
          <stop offset="0.45" stopColor={C.asphalt} />
          <stop offset="1" stopColor={mix(C.asphalt, C.night, 0.55)} />
        </linearGradient>
        <radialGradient id={id("sun")}>
          <stop offset="0" stopColor={C.cream} />
          <stop offset="0.45" stopColor={mix(C.cream, C.amber, 0.6)} />
          <stop offset="0.78" stopColor={mix(C.amber, C.orange, 0.55)} />
          <stop offset="1" stopColor={mix(C.orange, C.pink, 0.4)} />
        </radialGradient>
        <radialGradient id={id("halo")}>
          <stop offset="0" stopColor={C.amber} stopOpacity="0.85" />
          <stop offset="0.18" stopColor={mix(C.amber, C.orange, 0.5)} stopOpacity="0.5" />
          <stop offset="0.45" stopColor={C.pink} stopOpacity="0.18" />
          <stop offset="1" stopColor={C.pink} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("lamp")}>
          <stop offset="0" stopColor={C.cream} />
          <stop offset="0.25" stopColor={C.sodium} stopOpacity="0.75" />
          <stop offset="1" stopColor={C.sodiumNight} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("pool")}>
          <stop offset="0" stopColor={C.sodium} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.sodiumNight} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("cloud")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.lilac} stopOpacity="0" />
          <stop offset="0.5" stopColor={mix(C.amber, C.pink, 0.5)} stopOpacity="0.55" />
          <stop offset="1" stopColor={C.pink} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("cloudDim")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.dusk} stopOpacity="0" />
          <stop offset="0.5" stopColor={mix(C.lilac, C.pink, 0.4)} stopOpacity="0.35" />
          <stop offset="1" stopColor={C.lilac} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("fade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.night} stopOpacity="0" />
          <stop offset="1" stopColor={C.night} />
        </linearGradient>
        <linearGradient id={id("land")} x1="0" y1={hy} x2="0" y2={hy + (H - hy) * 0.6} gradientUnits="userSpaceOnUse">
          {/* The headland's ground: hazy where it runs off toward the city, the night's at the palms' feet. */}
          <stop offset="0" stopColor={mix(C.lilac, C.dusk, 0.55)} />
          <stop offset="0.25" stopColor={mix(C.dusk, C.deep, 0.6)} />
          <stop offset="0.6" stopColor={C.deep} />
        </linearGradient>
        <clipPath id={id("above")}>
          <rect x="0" y="0" width={W} height={hy} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width={W} height={hy} fill={url("sky")} />
      <g>
        {scene.stars.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill={C.moon}
            opacity={star.o}
            className={star.twinkle ? styles.twinkle : undefined}
            style={star.twinkle ? style({ "--dur": `${star.dur}s`, "--delay": `${star.delay}s` }) : undefined}
          />
        ))}
      </g>
      <path d={scene.moon} fill={C.moon} opacity="0.85" />
      <ellipse cx={sun.x} cy={hy} rx={Math.max(W, H) * 0.75} ry={hy * 0.85} fill={url("halo")} opacity="0.9" />
      <g className={styles.drift}>
        {scene.clouds.map((cloud, i) => (
          <ellipse key={i} cx={cloud.cx} cy={cloud.cy} rx={cloud.rx} ry={cloud.ry} fill={url(cloud.dim ? "cloudDim" : "cloud")} opacity={cloud.o} />
        ))}
      </g>

      {/* The sun, clipped by the sea: it sinks as the city loads. */}
      <g clipPath={url("above")}>
        <g className={styles.sun}>
          <circle cx={sun.x} cy={hy} r={sun.r * 1.6} fill={url("halo")} opacity="0.9" />
          <circle cx={sun.x} cy={hy} r={sun.r} fill={url("sun")} />
          <ellipse cx={sun.x - sun.r * 0.3} cy={hy - sun.r * 0.55} rx={sun.r * 1.5} ry={Math.max(2, sun.r * 0.045)} fill={mix(C.pink, C.haze, 0.5)} opacity="0.7" />
          <ellipse cx={sun.x + sun.r * 0.5} cy={hy - sun.r * 0.25} rx={sun.r * 1.1} ry={Math.max(1.5, sun.r * 0.03)} fill={mix(C.pink, C.orange, 0.3)} opacity="0.6" />
        </g>
      </g>

      {/* Far away: the islet with its palms at their size, and the city at the end of the road. */}
      <g opacity="0.88">
        <path d={scene.islet.land} fill={mix(C.lilac, C.dusk, 0.35)} />
        {scene.islet.bushes.map((bush, i) => (
          <ellipse key={i} cx={bush.cx} cy={bush.cy} rx={bush.rx} ry={bush.ry} fill={mix(C.lilac, C.dusk, 0.42)} />
        ))}
        <path d={scene.islet.palms.join("")} fill="none" stroke={mix(C.lilac, C.dusk, 0.5)} strokeWidth="0.85" strokeLinecap="round" />
      </g>
      <path d={scene.city.skyline} fill={mix(C.lilac, C.haze, 0.3)} opacity="0.88" />
      <path className={styles.windows} d={scene.city.windows} fill={C.sodium} />

      <rect x="0" y={hy} width={W} height={H - hy} fill={url("sea")} />
      <rect x="0" y={hy - 0.5} width={W} height="1.2" fill={C.cream} opacity="0.7" />
      <g>
        {scene.glitter.map((g, i) => (
          <rect
            key={i}
            x={g.x}
            y={g.y}
            width={g.w}
            height={g.h}
            rx="1"
            fill={i % 3 ? mix(C.amber, C.cream, 0.4) : C.cream}
            opacity={g.o}
            className={styles.shimmer}
            style={style({ "--dur": `${g.dur}s`, "--delay": `${g.delay}s`, "--o": g.o })}
          />
        ))}
        {scene.swells.map((s, i) => (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            fill={mix(C.pink, C.cream, 0.5)}
            opacity={s.o}
            className={styles.shimmer}
            style={style({ "--dur": `${s.dur}s`, "--delay": `${s.delay}s`, "--o": s.o })}
          />
        ))}
      </g>

      {/* The lamps' reflections on the water beside the deck, broken by the swell. */}
      <g>
        {scene.lamps.map((lamp) =>
          lamp.reflection ? (
            <g key={lamp.index} className={styles.light} style={style({ "--i": lamp.index })}>
              {ripples(lamp.reflection).map((ripple, i) => (
                <rect
                  key={i}
                  x={ripple.x}
                  y={ripple.y}
                  width={ripple.w}
                  height={ripple.h}
                  rx={ripple.h / 2}
                  fill={C.sodium}
                  opacity={ripple.o}
                  className={styles.shimmer}
                  style={style({ "--dur": `${1.4 + (i % 3) * 0.5}s`, "--delay": `${-i * 0.37}s`, "--o": ripple.o })}
                />
              ))}
            </g>
          ) : null,
        )}
      </g>

      {/* The causeway: piers, the deck's edge, the road with its marks and its parapets. */}
      <path d={scene.road.piers.join("")} fill={C.deep} />
      <path d={scene.road.surface} fill={url("road")} />
      <path d={scene.road.edgeLines.join("")} fill={C.cream} opacity="0.55" />
      <path d={scene.road.dashes.join("")} fill={C.sodium} opacity="0.7" />
      <g>
        {scene.lamps.map((lamp) => (
          <ellipse
            key={lamp.index}
            className={styles.light}
            style={style({ "--i": lamp.index })}
            cx={lamp.pool.x}
            cy={lamp.pool.y}
            rx={lamp.pool.rx}
            ry={lamp.pool.ry}
            fill={url("pool")}
          />
        ))}
      </g>
      <path d={scene.road.leftParapet} fill={mix(C.ink, C.lilac, 0.25)} />
      <path d={scene.road.leftTop} fill={C.amber} opacity="0.7" />
      <path d={scene.road.fascia} fill={C.deep} />
      <path d={scene.road.rightParapet} fill={C.ink} />
      <path d={scene.road.rightTop} fill={mix(C.amber, C.pink, 0.4)} opacity="0.75" />

      <g>
        {scene.lamps.map((lamp) => (
          <g key={lamp.index}>
            <path d={lamp.pole} fill="none" stroke={C.deep} strokeWidth={lamp.poleWidth} strokeLinecap="round" />
            <circle className={styles.light} style={style({ "--i": lamp.index })} cx={lamp.head.x} cy={lamp.head.y} r={lamp.glow} fill={url("lamp")} />
            <ellipse className={styles.head} style={style({ "--i": lamp.index })} cx={lamp.head.x} cy={lamp.head.y} rx={lamp.head.rx} ry={lamp.head.ry} fill={C.cream} />
          </g>
        ))}
      </g>

      {/* The headland on the right, the sun's light along its sand, and its palms framing the shot. */}
      <path d={scene.shore.land} fill={url("land")} />
      {/* Wet sand catching the sky, then the dry edge lit by the low sun. */}
      <path d={scene.shore.sand} fill="none" stroke={mix(C.pink, C.lilac, 0.4)} strokeWidth="9" strokeLinecap="round" opacity="0.16" />
      <path d={scene.shore.sand} fill="none" stroke={mix(C.amber, C.pink, 0.55)} strokeWidth="2.6" strokeLinecap="round" opacity="0.6" />
      {scene.palms.map((palm, i) => {
        // The farther palm a little lighter, in the haze; the nearest in the night's ink.
        const tone = i === scene.palms.length - 1 ? C.ink : mix(C.ink, C.lilac, 0.16);
        return (
          <g key={i}>
            <path d={palm.trunk} fill={tone} />
            <path d={palm.rim} fill="none" stroke={mix(C.lilac, C.haze, 0.3)} strokeWidth={palm.width} opacity="0.5" />
            <g
              className={styles.sway}
              style={style({ transformOrigin: `${palm.crown.x}px ${palm.crown.y}px`, "--dur": `${6 + i * 1.3}s`, "--delay": `${-i * 2.1}s` })}
            >
              <path d={palm.leaflets} fill="none" stroke={tone} strokeWidth={palm.width} strokeLinecap="round" />
              <path d={palm.spines} fill={tone} />
              {palm.nuts.map((nut, j) => (
                <circle key={j} cx={nut.x} cy={nut.y} r={nut.r} fill={tone} />
              ))}
            </g>
          </g>
        );
      })}
      <path d={scene.shore.grass} fill={C.deep} />

      {/* On a tall screen the picture ends under the menu: it fades into the night below. */}
      {name === "tall" ? <rect x="0" y={hy + (H - hy) * 0.45} width={W} height={(H - hy) * 0.55 + 1} fill={url("fade")} /> : null}

      <g className={styles.flock}>
        {scene.birds.map((bird, i) => (
          <path
            key={i}
            className={styles.bird}
            d={bird.d}
            fill="none"
            stroke={mix(C.ink, C.dusk, 0.3)}
            strokeWidth={bird.width}
            strokeLinecap="round"
            style={style({ "--delay": `${bird.delay}s` })}
          />
        ))}
      </g>
    </svg>
  );
}

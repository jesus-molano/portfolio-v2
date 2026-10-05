export const skyVertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // The dome is centred on the camera, so the local position is the view
    // direction.
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Direction-based afterglow, as a function: the colour depends only on a
 * direction (elevation and heading relative to the sun), so the dome has no
 * edges in any shot, and the water can ask it for the direction it
 * reflects. Warm peach under the sun, cooler lilac away from it.
 * Uniforms come from `createSkyUniforms` (scene/skyUniforms.ts).
 */
export const skyGradientChunk = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMiddle;
  uniform vec3 uHorizon;
  uniform vec3 uAwayMiddle;
  uniform vec3 uAwayHorizon;
  uniform vec3 uGlow;

  // Unit heading of the sun on the ground plane. Straight ahead (-z) if the
  // sun were overhead, so no normalize() of a zero vector.
  vec2 skySunHeading(vec3 toSun) {
    float planar = length(toSun.xz);
    return planar > 1e-4 ? toSun.xz / planar : vec2(0.0, -1.0);
  }

  // dir and toSun are unit vectors.
  vec3 skyGradient(vec3 dir, vec3 toSun) {
    vec2 sunHeading = skySunHeading(toSun);
    // At the zenith the heading is undefined; fall back to the sun heading
    // so no pixel can turn NaN (bloom would spread it over the frame).
    float planar = length(dir.xz);
    vec2 heading = planar > 1e-4 ? dir.xz / planar : sunHeading;
    float cosAz = dot(heading, sunHeading);
    float sinAz = heading.x * sunHeading.y - heading.y * sunHeading.x;
    float azimuth = atan(sinAz, cosAz);
    float warm = smoothstep(0.0, 1.0, cosAz * 0.5 + 0.5);

    // Elevation ramp, matched to the old flat backdrop seen from the car.
    float t = clamp(0.3 + dir.y * 1.05, 0.0, 1.0);
    vec3 horizon = mix(uAwayHorizon, uHorizon, warm);
    vec3 middle = mix(uAwayMiddle, uMiddle, warm);
    vec3 color = mix(horizon, middle, smoothstep(0.0, 0.42, t));
    color = mix(color, uTop, smoothstep(0.42, 0.95, t));

    // Afterglow band that hugs the horizon, strongest under the sun.
    float band = exp(-dir.y * dir.y * 140.0) * warm * warm;
    color += uGlow * band * 0.18;

    // Warm glow around the sun, stretched horizontally.
    vec2 d = vec2(azimuth * 0.375, (dir.y - toSun.y) * 1.8);
    float glow = exp(-dot(d, d) * 22.0);
    color += uGlow * glow * 0.55;
    return color;
  }
`;

/**
 * Lit clouds, after the cloud block of three.js' Sky (examples/jsm/objects/
 * Sky.js): gradient-noise fbm with a per-octave drift so they billow
 * instead of sliding as one stamp, coverage regions that leave clear gaps,
 * Beer and powder self-shadowing, a silver lining toward the sun, a fade
 * into the horizon haze, and the sun glow hidden behind cloud. Coloured
 * from our palette instead of a physical sky: peach-gold where they face
 * the sun, pink on the lit faces away from it, lavender and violet bellies.
 *
 * Two layers, fixed to the sky (they drift with time, never with the
 * drive):
 * - a low cumulus bank heaped along the horizon behind the skyline, mapped
 *   on a cylinder around the camera so the heaps keep their shape down to
 *   the horizon (a plane projection squashes them into streaks there); the
 *   lattice wraps once around the horizon, so there is no seam;
 * - higher streaky altocumulus on a plane projection.
 *
 * CLOUD_OCTAVES sets the fbm detail (fewer on the low tier); CLOUD_SHADOW
 * adds a second density sample toward the sun for directional
 * self-shadowing of the bank (high tier).
 */
export const skyCloudsChunk = /* glsl */ `
  #ifndef CLOUD_OCTAVES
  #define CLOUD_OCTAVES 5
  #endif

  uniform float uCloudTime;
  uniform vec3 uCloudSun;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform vec3 uCloudShadeWarm;

  const float CLOUD_TAU = 6.2831853;
  // Lattice cells once around the horizon for the cumulus bank (one cell is
  // about 11 degrees of azimuth). An integer, so the lattice wraps.
  const float BANK_CELLS = 32.0;
  // Bank lattice cells per unit of elevation (dir.y): heaps come out a
  // little wider than tall, as distant cumulus do.
  const float BANK_V = BANK_CELLS / CLOUD_TAU * 1.4;
  // Highest heap top, as dir.y (about 20 degrees).
  const float BANK_MAX_TOP = 0.34;

  // Gradient at a lattice corner; sinless hash, so every GPU draws the same
  // clouds.
  vec2 cloudHash(vec2 i) {
    vec3 p = fract(i.xyx * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xx + p.yz) * p.zy) * 2.0 - 1.0;
  }

  // 2D gradient noise, about [-1, 1]. With period > 0 the lattice wraps on
  // x every period cells.
  float cloudNoise(vec2 p, float period) {
    vec2 i0 = floor(p);
    vec2 f = fract(p);
    vec2 i1 = i0 + 1.0;
    if (period > 0.0) {
      i0.x = mod(i0.x, period);
      i1.x = mod(i1.x, period);
    }
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = dot(cloudHash(i0), f);
    float b = dot(cloudHash(vec2(i1.x, i0.y)), f - vec2(1.0, 0.0));
    float c = dot(cloudHash(vec2(i0.x, i1.y)), f - vec2(0.0, 1.0));
    float d = dot(cloudHash(i1), f - vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.6;
  }

  // fbm with a per-octave drift: the octaves slide against each other, so
  // the clouds billow. Doubling keeps an integer period an integer. With
  // billow > 0 the finer octaves fold (abs) into rounded puffs with creases
  // between them: the cauliflower edge of a cumulus.
  float cloudFbm(vec2 p, vec2 drift, float period, int octaves, float billow) {
    float result = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < CLOUD_OCTAVES; i++) {
      if (i >= octaves) break;
      float n = cloudNoise(p, period);
      // abs(n) averages about 0.35; recentred so the coverage holds.
      if (i > 0) n = mix(n, abs(n) * 2.0 - 0.7, billow);
      result += amplitude * n;
      amplitude *= 0.5;
      p = p * 2.0 + drift;
      period *= 2.0;
    }
    return result;
  }

  // Forward scattering (Henyey-Greenstein, g = 0.7): the silver lining on
  // rims toward the sun. The base never drops under 0.09.
  float cloudSilver(float cosTheta) {
    float base = max(1.49 - cosTheta * 1.4, 0.09);
    return clamp(0.51 / (base * sqrt(base)), 0.0, 3.0);
  }

  // A direction on the bank's cylinder, in lattice units: x runs once
  // around the horizon (0..BANK_CELLS), y is the elevation.
  vec2 bankCoords(vec3 dir) {
    float planar = length(dir.xz);
    vec2 heading = planar > 1e-4 ? dir.xz / planar : vec2(0.0, -1.0);
    // atan(x, -z): 0 straight ahead; a unit heading is never (0, 0).
    float azimuth = atan(heading.x, -heading.y);
    return vec2((azimuth / CLOUD_TAU + 0.5) * BANK_CELLS, dir.y * BANK_V);
  }

  // The cumulus bank at bank coordinates p: x = depth into the cloud above
  // its edge (negative outside), y = the heap's top there (as dir.y). Dense
  // on the horizon, thinning to puffy tops, with low stretches between the
  // towering heaps.
  vec2 bankField(vec2 p, float clearing, int octaves) {
    float t = uCloudTime;
    float elevation = p.y / BANK_V;
    float region = cloudNoise(vec2(p.x * 0.25 + t * 0.002, 3.7), BANK_CELLS * 0.25) * 0.5 + 0.5;
    float top = mix(0.05, BANK_MAX_TOP, smoothstep(0.15, 0.8, region)) * (1.0 - clearing);
    // A small lift so the base sits in the horizon haze, not under it.
    float h = clamp((elevation + 0.01) / (top + 0.01), 0.0, 1.5);
    float coverage = mix(0.95, 0.08, smoothstep(0.0, 1.0, h));
    vec2 drift = vec2(t * 0.011, -t * 0.004);
    float n = cloudFbm(p + vec2(t * 0.012, 0.0), drift, BANK_CELLS, octaves, 0.7) + 0.5;
    return vec2(n - (1.0 - coverage), top);
  }

  // Altocumulus plane coordinates of a direction, drifted by the wind.
  vec2 altoCoords(vec3 dir) {
    // Plane at height 1; the offset keeps the horizon finite.
    vec2 q = dir.xz / (max(dir.y, 0.0) + 0.09) * 1.15;
    q += vec2(uCloudTime * 0.012, uCloudTime * 0.004);
    // Streaks run off the road axis.
    return mat2(0.87, -0.5, 0.5, 0.87) * q;
  }

  // Altocumulus at plane coordinates q, seen at elevation y (dir.y):
  // x = depth above the edge, y = noise.
  vec2 altoField(vec2 q, float y, int octaves) {
    // Regions small enough that every view of the high sky holds some
    // cloud and some clear sky.
    float region = cloudNoise(q * 0.32 + 11.0, 0.0) * 0.5 + 0.5;
    float coverage = mix(0.3, 0.72, smoothstep(0.25, 0.75, region));
    // The plane projection packs the whole sky above ~25 degrees into one
    // or two regions, so a clear one empties the top of a portrait frame
    // (the phone sees up to ~50 degrees). A little more cover overhead.
    coverage += smoothstep(0.4, 0.85, y) * 0.18;
    vec2 streak = vec2(q.x * 0.7, q.y * 2.2);
    float n = cloudFbm(streak, vec2(uCloudTime * 0.006, 0.0), 0.0, octaves, 0.0) + 0.5;
    return vec2(n - (1.0 - coverage), n);
  }

  // How much the sky clears around the sun (0.85 at the disc, 0 a few
  // degrees out), so the disc is framed by cloud, not buried in it.
  float cloudClearing(vec3 dir, vec3 toSun) {
    return exp((dot(dir, toSun) - 1.0) * 420.0) * 0.85;
  }

  // Where the altocumulus layer lives: above the bank, below the zenith.
  float altoBand(float y) {
    return smoothstep(0.07, 0.26, y) * (1.0 - smoothstep(0.75, 0.99, y));
  }

  // Opacity from the depth above the edge: a crisp edge, then Beer's law.
  float altoAlpha(float depth, float band, float clearing) {
    return smoothstep(0.0, 0.1, depth) * (1.0 - exp(-depth * 6.0)) * band * (1.0 - clearing) * 0.9;
  }

  float bankAlpha(float depth, float y) {
    return smoothstep(0.0, 0.04, depth) * (1.0 - exp(-depth * 16.0)) * smoothstep(-0.04, 0.0, y);
  }

  // Shades a cloud. depth: density above the edge; sunward: 0..1 toward
  // the sun; lift: 0 in the belly, 1 on the lit top; sky: the sky colour
  // behind it.
  vec3 cloudColor(float depth, float sunward, float lift, float cosTheta, vec3 sky) {
    // Beer-powder self-shadow from the sampled density (Sky.js).
    float beer = exp(depth * -4.0);
    float powder = 1.0 - beer * beer;
    float shade = mix(0.45, 1.0, clamp(beer * powder * 2.6, 0.0, 1.0));
    // Thin cloud near the edge lets the light through.
    float thin = exp(-depth * 9.0);
    // Away from the sun we see the lit faces: lift and self-shadow decide.
    float front = clamp(shade * lift, 0.0, 1.0);
    // Toward the sun the body stands in its own shadow and only the thin
    // rims glow: mauve heaps with gold edges, the sunset look.
    float back = clamp(thin * 0.9 + lift * 0.12, 0.0, 1.0);
    float light = mix(front, back, sunward);
    // Lit faces are brighter than the sky behind them (HDR), so the clouds
    // read as sunlit volumes, not as stains.
    vec3 lit = mix(uCloudLit, uCloudSun, sunward) * 1.35;
    vec3 belly = mix(uCloudShade, uCloudShadeWarm, sunward);
    vec3 color = mix(belly, lit, light);
    // Sky light fills the shadows a little.
    color = mix(color, sky, 0.1 * (1.0 - light));
    // Silver lining on the thin rims toward the sun: HDR, so it blooms.
    color += uCloudSun * cloudSilver(cosTheta) * thin * 0.6 * sunward;
    return color;
  }

  // Both cloud layers over the sky colour along dir. .rgb is the new
  // colour, .a the cloud cover.
  vec4 skyClouds(vec3 dir, vec3 toSun, vec3 sky) {
    if (dir.y < -0.04) return vec4(sky, 0.0);
    float cosTheta = dot(dir, toSun);
    float sunward = exp((cosTheta - 1.0) * 5.0);
    float clearing = cloudClearing(dir, toSun);
    vec3 color = sky;
    float clear = 1.0;

    // High streaky altocumulus, behind the bank.
    float band = altoBand(dir.y);
    if (band > 0.0) {
      vec2 field = altoField(altoCoords(dir), dir.y, CLOUD_OCTAVES);
      float depth = max(0.0, field.x);
      // Thin cloud lit from below by the low sun: bright undersides, a
      // little shade where it thickens.
      float lift = mix(0.5, 1.0, clamp(field.y, 0.0, 1.0));
      vec3 c = cloudColor(depth * 0.7, sunward, lift, cosTheta, sky);
      float alpha = altoAlpha(depth, band, clearing);
      color = mix(color, c, alpha);
      clear *= 1.0 - alpha;
    }

    // The cumulus bank on the horizon.
    if (dir.y < BANK_MAX_TOP) {
      vec2 p = bankCoords(dir);
      vec2 field = bankField(p, clearing, CLOUD_OCTAVES);
      float depth = max(0.0, field.x);
      if (depth > 0.0) {
        // Tops catch the low sun; bellies sit in the shade.
        float lift = smoothstep(-0.15, 0.85, (dir.y + 0.01) / (field.y + 0.01));
        #ifdef CLOUD_SHADOW
          // A second sample a little toward the sun: denser there means
          // this point lies in the shadow of its own heap.
          vec2 sunP = bankCoords(toSun);
          vec2 toward = vec2(mod(sunP.x - p.x + BANK_CELLS * 0.5, BANK_CELLS) - BANK_CELLS * 0.5, sunP.y - p.y);
          float len = length(toward);
          vec2 stepToward = len > 1e-4 ? toward / len * 0.3 : vec2(0.0);
          vec2 ahead = bankField(p + stepToward, clearing, CLOUD_OCTAVES - 1);
          lift *= 1.0 - clamp((ahead.x - field.x) * 4.0, 0.0, 1.0) * 0.7;
        #endif
        vec3 c = cloudColor(depth, sunward, lift, cosTheta, sky);
        // Aerial perspective: the bank melts into the horizon haze.
        float haze = 1.0 - smoothstep(-0.01, 0.06, dir.y);
        c = mix(c, sky, haze * 0.4);
        float alpha = bankAlpha(depth, dir.y);
        color = mix(color, c, alpha);
        clear *= 1.0 - alpha;
      }
    }
    return vec4(color, 1.0 - clear);
  }

  // Cloud cover alone (no shading), for the sun disc drawn over the dome.
  float skyCloudCover(vec3 dir, vec3 toSun) {
    if (dir.y < -0.04) return 0.0;
    float clearing = cloudClearing(dir, toSun);
    float clear = 1.0;
    float band = altoBand(dir.y);
    if (band > 0.0) {
      float depth = max(0.0, altoField(altoCoords(dir), dir.y, CLOUD_OCTAVES).x);
      clear *= 1.0 - altoAlpha(depth, band, clearing);
    }
    if (dir.y < BANK_MAX_TOP) {
      float depth = max(0.0, bankField(bankCoords(dir), clearing, CLOUD_OCTAVES).x);
      clear *= 1.0 - bankAlpha(depth, dir.y);
    }
    return 1.0 - clear;
  }
`;

/**
 * The sky dome: the afterglow gradient with the lit clouds over it. The
 * same shader renders the environment map, so paint and chrome reflect
 * these clouds.
 */
export const skyFragmentShader = /* glsl */ `
  uniform vec3 uSunPosition;
  varying vec3 vDir;
  ${skyGradientChunk}
  ${skyCloudsChunk}

  void main() {
    float l = length(vDir);
    vec3 dir = l > 1e-6 ? vDir / l : vec3(0.0, 1.0, 0.0);
    vec3 toSunRaw = uSunPosition - cameraPosition;
    float sunLength = length(toSunRaw);
    vec3 toSun = sunLength > 1e-4 ? toSunRaw / sunLength : vec3(0.0, 0.0, -1.0);
    vec3 color = skyGradient(dir, toSun);
    color = skyClouds(dir, toSun, color).rgb;
    gl_FragColor = vec4(color, 1.0);
  }
`;

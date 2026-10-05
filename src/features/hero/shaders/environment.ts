/**
 * Extra layers of the environment map (SkyEnvironment). The sky dome shader
 * draws the sky itself; these add what a car body would mirror below and on
 * the horizon. Both run on BackSide spheres centred on the cube camera, so
 * the local position is the view direction (skyVertexShader).
 */

/**
 * The ground the paint mirrors: haze-pink water at the horizon, deep violet
 * asphalt straight down. Without it the lower body would mirror the bright
 * horizon colour and the car would float. Blended over the sky.
 */
export const environmentGroundFragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uDeep;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    // 1 below the horizon, 0 above, with a short melt so the line is soft.
    float below = 1.0 - smoothstep(-0.03, 0.002, dir.y);
    vec3 color = mix(uHorizon, uDeep, smoothstep(0.0, 0.45, -dir.y));
    gl_FragColor = vec4(color, below);
  }
`;

/**
 * Additive lights: the low sun as a hot disc with a soft limb (the paint
 * highlight) and a thin warm strip along the horizon, brightest under the
 * sun. Values are HDR on purpose; the tone mapping rolls them off.
 */
export const environmentLightsFragmentShader = /* glsl */ `
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunCos;
  uniform float uSunSoftCos;
  uniform vec3 uStripColor;
  uniform float uStripWidth;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float facing = dot(dir, uSunDirection);
    float sun = smoothstep(uSunSoftCos, uSunCos, facing);

    // Brighter toward the sun, faint behind it.
    float warm = clamp(facing * 0.5 + 0.5, 0.0, 1.0);
    float across = (dir.y - uStripWidth * 0.6) / uStripWidth;
    float strip = exp(-across * across) * (0.25 + 0.75 * warm * warm);

    gl_FragColor = vec4(uSunColor * sun + uStripColor * strip, 1.0);
  }
`;

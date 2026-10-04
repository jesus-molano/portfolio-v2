export const waterVertexShader = /* glsl */ `
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Stylised dusk sea: deep violet up close, pink toward the horizon so the
 * horizon line melts into the sky, slow swells that stream with the drive,
 * and a smooth glitter path under the sun (no per-frame random twinkle).
 */
export const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDistance;
  uniform float uSunX;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform vec3 uGlint;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    float dist = length(vWorld.xz - cameraPosition.xz);
    float t = smoothstep(10.0, 480.0, dist);
    vec3 color = mix(uNear, uFar, pow(t, 0.7));

    float z = vWorld.z - uDistance;
    float swell = sin(z * 0.21 + sin(vWorld.x * 0.035) * 2.2 + uTime * 0.45) * 0.5 + 0.5;
    float chop = sin(z * 0.63 - vWorld.x * 0.08 + uTime * 0.8) * 0.5 + 0.5;
    color += uFar * 0.07 * swell * chop * (1.0 - t);

    // Glitter path: widens with distance, made of smooth streaks.
    float width = 5.0 + dist * 0.14;
    // A square, not pow(): pow() of a negative base is NaN in GLSL.
    float across = (vWorld.x - uSunX) / width;
    float path = exp(-across * across);
    float streaks = pow(max(0.0, sin(vWorld.x * 1.7 + sin(z * 0.5) * 3.0) * sin(z * 1.3 + uTime * 1.1)), 10.0);
    color += uGlint * path * (0.22 * t + streaks * 0.75 * smoothstep(25.0, 160.0, dist));

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

export const sandVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Beach strip: dry sand on the inner edge (u = 0), wet sand toward the
 * water, a foam line and a soft alpha edge so the water shows through.
 * All patterns use `z - uDistance`, so the beach streams with the drive.
 */
export const sandFragmentShader = /* glsl */ `
  uniform vec3 uSand;
  uniform vec3 uWetSand;
  uniform vec3 uFoam;
  uniform float uTime;
  uniform float uDistance;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    float u = vUv.x;
    float z = vWorld.z - uDistance;
    // The shoreline wanders a little along the beach; waves lap slowly.
    float wobble = sin(z * 0.06 + 1.3) * 0.035 + sin(z * 0.17) * 0.015;
    float lap = sin(uTime * 0.7 + z * 0.12) * 0.012;
    float shore = 0.86 + wobble + lap;

    // Smooth tonal drift instead of per-cell grain (no visible squares).
    float grain = 1.0 + sin(z * 0.09 + vWorld.x * 0.13) * sin(z * 0.031 - vWorld.x * 0.05) * 0.04;
    // Wind ripples in the dry sand.
    float ripple = sin(z * 1.4 + vWorld.x * 0.3) * 0.5 + 0.5;
    vec3 color = mix(uSand, uWetSand, smoothstep(shore - 0.28, shore, u)) * grain;
    color *= 0.97 + ripple * 0.03 * (1.0 - smoothstep(0.4, 0.8, u));

    float foam = 1.0 - smoothstep(0.0, 0.022, abs(u - shore + 0.01));
    color = mix(color, uFoam, foam * 0.75);

    float alpha = 1.0 - smoothstep(shore, shore + 0.05, u);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), alpha);
  }
`;

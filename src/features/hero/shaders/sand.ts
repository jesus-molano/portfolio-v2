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
 * water, a thin foam line and a soft alpha edge so the water shows through.
 */
export const sandFragmentShader = /* glsl */ `
  uniform vec3 uSand;
  uniform vec3 uWetSand;
  uniform vec3 uFoam;
  uniform float uTime;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vFogDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float u = vUv.x;
    // The shoreline wanders a little along the beach.
    float wobble = sin(vWorld.z * 0.08 + vWorld.x * 0.03) * 0.04 + sin(vWorld.z * 0.21) * 0.02;
    float shore = 0.86 + wobble + sin(uTime * 0.6 + vWorld.z * 0.15) * 0.012;

    float grain = 0.95 + 0.1 * hash(floor(vWorld.xz * 6.0));
    vec3 color = mix(uSand, uWetSand, smoothstep(shore - 0.3, shore, u)) * grain;

    float foam = 1.0 - smoothstep(0.0, 0.025, abs(u - shore + 0.01));
    color = mix(color, uFoam, foam * 0.8);

    float alpha = 1.0 - smoothstep(shore, shore + 0.05, u);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), alpha);
  }
`;

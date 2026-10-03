export const roadVertexShader = /* glsl */ `
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
 * Wet asphalt causeway: speckled asphalt, a warm reflection of the sun
 * running down the middle, dashed center line and solid edge lines.
 */
export const roadFragmentShader = /* glsl */ `
  uniform float uDistance;
  uniform vec3 uAsphalt;
  uniform vec3 uLine;
  uniform vec3 uEdge;
  uniform vec3 uGlow;
  uniform float uHorizonZ;
  uniform float uSunX;
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
    float across = vUv.x * 2.0 - 1.0;
    float speckle = 0.92 + 0.16 * hash(floor(vWorld.xz * 14.0));
    vec3 color = uAsphalt * speckle;

    // Sun reflection on the wet surface: a soft column that leans toward the
    // sun as the road recedes.
    float toward = smoothstep(40.0, uHorizonZ, vWorld.z);
    float lean = clamp(uSunX * toward * 0.012, -0.9, 0.9);
    float dx = across - lean;
    float column = exp(-dx * dx * 5.0);
    color += uGlow * column * toward * 0.5;
    // Broad wet sheen from the sky.
    color += uGlow * 0.12 * toward;

    // Center dashes.
    float dash = step(0.55, fract((vWorld.z + uDistance) / 9.0));
    float center = 1.0 - smoothstep(0.012, 0.022, abs(across));
    color = mix(color, uLine, dash * center * 0.95);

    // Edge lines.
    float edge = 1.0 - smoothstep(0.012, 0.024, abs(abs(across) - 0.9));
    color = mix(color, uEdge, edge * 0.85);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

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

  void main() {
    float across = vUv.x * 2.0 - 1.0;
    // Ground-fixed pattern: it streams with the drive like the lane dashes.
    // Smooth, large patches of older and newer asphalt; no per-cell noise.
    float zg = vWorld.z - uDistance;
    float patches = sin(zg * 0.045 + sin(vWorld.x * 0.21) * 1.5) * sin(zg * 0.017 + 1.7);
    float speckle = 1.0 + patches * 0.05;
    // Faint darker tyre tracks along each of the four 4 m lanes.
    float lanePos = fract((vWorld.x + 8.0) / 4.0);
    // Squares, not pow(): pow() of a negative base is NaN in GLSL.
    float trackA = (lanePos - 0.3) * 14.0;
    float trackB = (lanePos - 0.7) * 14.0;
    float tracks = exp(-trackA * trackA) + exp(-trackB * trackB);
    speckle -= tracks * 0.06;
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

    // Four lanes, US style. x in metres across the 16 m road. The car drives
    // toward -z, so the dashes slide toward +z (past us).
    float x = across * 8.0;
    float dash = step(0.6, fract((vWorld.z - uDistance) / 12.0));
    // Double solid yellow in the centre.
    float centre = 1.0 - smoothstep(0.06, 0.1, abs(abs(x) - 0.18));
    color = mix(color, uLine, centre * 0.95);
    // Dashed white dividers between the two lanes of each direction.
    float divider = (1.0 - smoothstep(0.06, 0.1, abs(abs(x) - 4.0))) * dash;
    color = mix(color, uEdge, divider * 0.85);
    // Solid white edge lines.
    float edge = 1.0 - smoothstep(0.07, 0.11, abs(abs(x) - 7.6));
    color = mix(color, uEdge, edge * 0.85);

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

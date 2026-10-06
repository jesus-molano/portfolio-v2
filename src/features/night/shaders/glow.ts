/**
 * Soft additive glows that always face the camera (lamp heads, headlights,
 * brake lights, the haze in a flood's beam). Instanced: each glow has its
 * centre (instance matrix translation), its size (the matrix scale) and its
 * colour (instanceColor, HDR). `aLevel` dims it per instance.
 */
export const glowSpriteVertexShader = /* glsl */ `
  attribute float aLevel;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLevel;
  varying float vFogDepth;

  void main() {
    vUv = uv - 0.5;
    vColor = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #endif
    vLevel = aLevel;
    vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float size = length(instanceMatrix[0].xyz);
    vec4 mvPosition = centre + vec4(position.xy * size, 0.0, 0.0);
    vFogDepth = -centre.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const glowSpriteFragmentShader = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLevel;
  varying float vFogDepth;

  void main() {
    float r2 = dot(vUv, vUv) * 4.0;
    float core = exp(-r2 * 18.0);
    float halo = exp(-r2 * 3.5) * 0.35;
    float a = (core + halo) * vLevel * uIntensity;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    a *= 1.0 - fogFactor * 0.7;
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

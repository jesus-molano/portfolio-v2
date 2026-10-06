/**
 * City blocks at night, instanced boxes: dark violet at street level,
 * a little lighter toward the roofs where the city's glow catches them,
 * and the roofs' top faces a shade lighter still.
 */
export const nightBlockVertexShader = /* glsl */ `
  varying float vWorldY;
  varying float vUp;
  varying float vFogDepth;

  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldY = world.y;
    vUp = normal.y;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const nightBlockFragmentShader = /* glsl */ `
  uniform vec3 uBottom;
  uniform vec3 uTop;
  uniform float uHeight;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vWorldY;
  varying float vUp;
  varying float vFogDepth;

  void main() {
    float t = clamp(vWorldY / uHeight, 0.0, 1.0);
    vec3 color = mix(uBottom, uTop, t) * (1.0 + 0.25 * max(vUp, 0.0));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

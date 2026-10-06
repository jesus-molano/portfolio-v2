/**
 * Lit windows: one instanced plane per pane, each showing one cell of the
 * painted window atlas (`aCell`), so a café or a hotel room has an
 * interior (mullions, curtains, lamps, people) instead of a flat block.
 */
export const windowVertexShader = /* glsl */ `
  attribute float aCell;
  uniform float uCells;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vUv = vec2((aCell + uv.x) / uCells, uv.y);
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const windowFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGain;
  uniform float uFogAmount;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec3 color = texture2D(uMap, vUv).rgb * uGain;
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * uFogAmount;
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

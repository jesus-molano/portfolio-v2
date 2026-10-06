/**
 * Lit windows: one instanced plane per pane, each showing one cell of the
 * painted window atlas (`aCell`, on a grid of `uGrid` columns and rows), so
 * a café or a hotel room has an interior (mullions, curtains, lamps)
 * instead of a flat block. Per pane: `aLook` = (mirror, gain, flicker): a
 * mirrored cell, its own brightness, and a television's flicker, a few
 * changes a second on the cool channel, never to dark.
 */
export const windowVertexShader = /* glsl */ `
  attribute float aCell;
  attribute vec3 aLook;
  uniform vec2 uGrid;
  varying vec2 vUv;
  varying vec2 vLook;
  varying float vSeed;
  varying float vFogDepth;

  void main() {
    float col = mod(aCell, uGrid.x);
    float row = floor(aCell / uGrid.x);
    float u = aLook.x > 0.5 ? 1.0 - uv.x : uv.x;
    // Row 0 is the top of the canvas; textures are sampled with v up.
    vUv = vec2((col + u) / uGrid.x, 1.0 - (row + 1.0 - uv.y) / uGrid.y);
    vLook = aLook.yz;
    vSeed = aCell * 7.13 + instanceMatrix[3].x * 1.7 + instanceMatrix[3].y * 3.1;
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const windowFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGain;
  uniform float uFogAmount;
  uniform float uTime;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec2 vLook;
  varying float vSeed;
  varying float vFogDepth;

  void main() {
    vec3 color = texture2D(uMap, vUv).rgb * uGain * vLook.x;
    // A television: the cool light jumps between cuts, five or six a second.
    float cut = floor(uTime * 5.5 + vSeed);
    float n = fract(sin(cut * 12.9898 + vSeed) * 43758.5453);
    color *= mix(1.0, 0.7 + 0.5 * n, vLook.y);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * uFogAmount;
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

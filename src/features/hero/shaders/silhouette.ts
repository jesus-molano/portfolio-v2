/** Instanced, unlit silhouette with a vertical tint and scene fog. */
export const silhouetteVertexShader = /* glsl */ `
  varying float vFogDepth;
  varying float vWorldY;

  void main() {
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldY = worldPosition.y;
    vec4 mvPosition = viewMatrix * worldPosition;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const silhouetteFragmentShader = /* glsl */ `
  uniform vec3 uBottom;
  uniform vec3 uTop;
  uniform float uHeight;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vFogDepth;
  varying float vWorldY;

  void main() {
    float t = clamp(vWorldY / uHeight, 0.0, 1.0);
    vec3 color = mix(uBottom, uTop, t);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

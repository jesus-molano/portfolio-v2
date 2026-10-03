export const palmVertexShader = /* glsl */ `
  attribute float aSway;
  uniform float uTime;
  varying float vFogDepth;

  void main() {
    vec3 p = position;
    vec4 origin = instanceMatrix[3];
    float phase = origin.x * 0.37 + origin.z * 0.21;
    float sway = aSway * (sin(uTime * 1.1 + phase) * 0.35 + sin(uTime * 2.3 + phase * 1.7) * 0.08);
    p.x += sway;
    p.z += sway * 0.4;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const palmFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vFogDepth;

  void main() {
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(uColor, fogColor, fogFactor), 1.0);
  }
`;

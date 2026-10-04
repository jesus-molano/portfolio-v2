export const palmVertexShader = /* glsl */ `
  attribute float aSway;
  attribute float aShade;
  attribute float aFlutter;
  uniform float uTime;
  varying float vFogDepth;
  varying float vShade;

  void main() {
    vec3 p = position;
    vec4 origin = instanceMatrix[3];
    float phase = origin.x * 0.37 + origin.z * 0.21;
    // Slow sway of the whole palm, stronger toward the frond tips.
    float sway = aSway * (sin(uTime * 1.1 + phase) * 0.3 + sin(uTime * 2.3 + phase * 1.7) * 0.07);
    p.x += sway;
    p.z += sway * 0.4;
    // Quick flutter of the leaflet tips.
    float flutter = aFlutter * sin(uTime * 4.7 + phase * 3.0 + position.x * 1.9 + position.z * 1.3);
    p.y += flutter * 0.07;
    p.x += flutter * 0.03;

    vShade = aShade;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const palmFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uTip;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vFogDepth;
  varying float vShade;

  void main() {
    // Deep violet silhouette, lifted toward lilac at the frond tips.
    vec3 color = mix(uColor, uTip, clamp(vShade, 0.0, 1.0));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

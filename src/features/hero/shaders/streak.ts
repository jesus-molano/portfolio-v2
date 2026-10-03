export const streakVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

/** Long-exposure light trail: bright head, fading tail, soft sides. */
export const streakFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    float along = vUv.y;
    float side = abs(vUv.x - 0.5) * 2.0;
    float body = smoothstep(0.0, 0.15, along) * pow(along, 1.6);
    float width = exp(-side * side * 6.0);
    float head = exp(-pow((1.0 - along) * 10.0, 2.0)) * 1.5;
    float a = (body + head) * width;
    gl_FragColor = vec4(uColor * uIntensity * a, a);
  }
`;

/** Soft radial disc: contact shadows and pools of light. No hard edges. */
export const softDiscFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = dot(p, p);
    float a = (1.0 - smoothstep(0.05, 1.0, d));
    a = a * a * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

export const softDiscVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const softDiscInstancedVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

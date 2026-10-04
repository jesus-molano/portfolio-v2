export const contactShadowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

/** Soft radial shadow that grounds an object on the sand. */
export const contactShadowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = dot(p, p);
    float a = (1.0 - smoothstep(0.15, 1.0, d)) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

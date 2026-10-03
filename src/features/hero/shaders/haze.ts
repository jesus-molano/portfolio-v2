export const hazeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const hazeFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float vertical = pow(1.0 - vUv.y, 2.2);
    float horizontal = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 3.0);
    gl_FragColor = vec4(uColor, vertical * horizontal * uOpacity);
  }
`;

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
    // Clamp every base: at the plane edges the interpolated UV can leave
    // [0, 1] by a hair, and pow() of a negative base is NaN. Bloom spreads
    // one NaN pixel over the whole frame, which shows as a black flash.
    float v = clamp(1.0 - vUv.y, 0.0, 1.0);
    float h = clamp(abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
    float vertical = pow(v, 2.2);
    float horizontal = 1.0 - h * h * h;
    gl_FragColor = vec4(uColor, vertical * horizontal * uOpacity);
  }
`;

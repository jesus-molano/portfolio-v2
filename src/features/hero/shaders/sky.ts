export const skyVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMiddle;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec2 uSunUv;
  varying vec2 vUv;

  void main() {
    float t = vUv.y;
    vec3 color = mix(uHorizon, uMiddle, smoothstep(0.0, 0.35, t));
    color = mix(color, uTop, smoothstep(0.35, 1.0, t));

    // Warm glow around the sun position, stretched horizontally.
    vec2 d = (vUv - uSunUv) * vec2(1.0, 2.2);
    float glow = exp(-dot(d, d) * 18.0);
    color += uGlow * glow * 0.9;

    gl_FragColor = vec4(color, 1.0);
  }
`;

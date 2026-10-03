export const sunVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const sunFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTop;
  uniform vec3 uMiddle;
  uniform vec3 uBottom;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);
    // Soft disc edge with a faint outer glow ring.
    float disc = 1.0 - smoothstep(0.92, 1.0, d);
    float glow = (1.0 - smoothstep(0.6, 1.0, d)) * 0.25;

    float t = vUv.y;
    vec3 color = mix(uBottom, uMiddle, smoothstep(0.0, 0.5, t));
    color = mix(color, uTop, smoothstep(0.5, 1.0, t));

    // Synthwave bands: gaps that get wider toward the bottom and drift slowly.
    float bandFreq = 13.0;
    float gap = mix(0.55, 0.05, smoothstep(0.0, 0.55, t));
    float band = step(gap, fract(t * bandFreq - uTime * 0.08));
    float bands = mix(band, 1.0, smoothstep(0.5, 0.6, t));

    float alpha = disc * bands + glow;
    gl_FragColor = vec4(color * uIntensity, alpha);
  }
`;

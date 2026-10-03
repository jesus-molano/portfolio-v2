export const birdVertexShader = /* glsl */ `
  attribute float aWing;
  uniform float uTime;
  void main() {
    vec3 p = position;
    vec4 origin = instanceMatrix[3];
    float phase = origin.x * 1.7 + origin.y * 0.9;
    // Wing tips flap; the body stays still.
    p.y += sin(uTime * 7.0 + phase) * 0.55 * aWing;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

export const birdFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

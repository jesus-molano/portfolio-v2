export const birdVertexShader = /* glsl */ `
  attribute float aWing;
  uniform float uTime;
  void main() {
    vec3 p = position;
    vec4 origin = instanceMatrix[3];
    // Per bird, from coordinates that do not change as the flock crosses.
    float phase = origin.z * 2.3 + origin.y * 0.9;
    // Wing tips flap, now harder, now nearly gliding; the body stays still.
    float stroke = 0.38 + 0.2 * sin(uTime * 0.8 + phase);
    p.y += sin(uTime * 6.5 + phase) * stroke * aWing;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

export const birdFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

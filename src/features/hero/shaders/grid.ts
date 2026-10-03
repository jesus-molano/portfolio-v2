export const gridVertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const gridFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSpacing;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  varying vec3 vWorld;

  void main() {
    vec2 coord = vec2(vWorld.x, vWorld.z + uTime * uSpeed) / uSpacing;
    vec2 g = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
    float line = 1.0 - min(min(g.x, g.y), 1.0);

    float dist = distance(vWorld, cameraPosition);
    float fade = (1.0 - smoothstep(40.0, 230.0, dist)) * smoothstep(2.0, 12.0, dist);

    float mixT = smoothstep(-120.0, 120.0, vWorld.x);
    vec3 color = mix(uColorA, uColorB, mixT);

    gl_FragColor = vec4(color * uIntensity, line * fade);
  }
`;

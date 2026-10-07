/**
 * The haze in a light's beam: an open cone, additive, faded toward its
 * rim (the guarded `1 - |n·v|`) and along its length. depthWrite off.
 */
export const beamVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAlong;
  varying float vFogDepth;

  void main() {
    // The cone geometry is of unit height, from y = 0.5 (apex) to y = -0.5
    // (mouth); the mesh is scaled to the beam's length.
    vAlong = clamp(0.5 - position.y, 0.0, 1.0);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const beamFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLevel;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAlong;
  varying float vFogDepth;

  void main() {
    float viewLen = max(length(vView), 1e-3);
    vec3 v = vView / viewLen;
    vec3 n = normalize(vNormal);
    float edge = 1.0 - abs(dot(n, v));
    float soft = (1.0 - edge) * (1.0 - edge);
    float fall = (1.0 - vAlong) * smoothstep(0.0, 0.12, vAlong);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    // Never negative: an additive pass into a float buffer would subtract light.
    float a = max(soft * fall * uLevel * (1.0 - fogFactor), 0.0);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

/**
 * The searchlight's shaft in the haze (Logixs, searchlight.ts): the same
 * open cone, from the helicopter's lamp far over the frame down to its spot
 * on the wall. A beam, not a slab: bright down its middle and gone at its
 * sides (the facing to the sixth, written as squares), denser toward the
 * lamp, so the top of the frame carries it, with slow dust drifting through
 * it, and fading out just before the wall so the shaft never doubles the
 * spot. The mesh is always drawn (its program compiled with the set);
 * uLevel 0, the light off, discards every fragment.
 */
export const searchBeamVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  varying float vAlong;
  varying float vFogDepth;

  void main() {
    vAlong = clamp(0.5 - position.y, 0.0, 1.0);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = mat3(modelMatrix) * normal;
    vView = cameraPosition - world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const searchBeamFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLevel;
  uniform float uTime;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  varying float vAlong;
  varying float vFogDepth;

  float dustHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  // Value noise in 3D, smooth: the dust's density.
  float dustNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(dustHash(i), dustHash(i + vec3(1.0, 0.0, 0.0)), u.x), mix(dustHash(i + vec3(0.0, 1.0, 0.0)), dustHash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y);
    float b = mix(mix(dustHash(i + vec3(0.0, 0.0, 1.0)), dustHash(i + vec3(1.0, 0.0, 1.0)), u.x), mix(dustHash(i + vec3(0.0, 1.0, 1.0)), dustHash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y);
    return mix(a, b, u.z);
  }

  void main() {
    if (uLevel < 0.001) discard;
    float viewLen = max(length(vView), 1e-3);
    vec3 v = vView / viewLen;
    vec3 n = vNormal / max(length(vNormal), 1e-4);
    float facing = abs(dot(n, v));
    float f2 = facing * facing;
    float core = f2 * f2 * f2;
    // Denser toward the lamp (vAlong 0): in the frame, the last fifth of
    // the beam before the wall, it is brightest at the top of the picture
    // and gone just before the spot (vAlong 1).
    float fall = (1.6 - vAlong) * (1.0 - smoothstep(0.86, 0.985, vAlong)) * smoothstep(0.0, 0.08, vAlong);
    // Slow dust drifting down and along the beam.
    vec3 drift = vec3(0.07, -0.18, 0.05) * uTime;
    float dust = 0.35 + 0.75 * dustNoise(vWorld * 1.4 + drift) + 0.3 * dustNoise(vWorld * 4.3 - drift * 1.7);
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    float a = max(core * fall * dust * uLevel * (1.0 - fogFactor), 0.0);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

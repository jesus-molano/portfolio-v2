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
 * open cone, seen only over its last stretch before the wall (its lamp is
 * far over the frame), fading out just before the spot so the shaft never
 * doubles it. uLevel 0 when the light is off.
 */
export const searchBeamFragmentShader = /* glsl */ `
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
    float facing = abs(dot(n, v));
    float soft = facing * facing;
    float fall = smoothstep(0.4, 0.85, vAlong) * (1.0 - smoothstep(0.93, 1.0, vAlong));
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    float a = max(soft * fall * uLevel * (1.0 - fogFactor), 0.0);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

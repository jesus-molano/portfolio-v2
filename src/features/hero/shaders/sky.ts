export const skyVertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // The dome is centred on the camera, so the local position is the view
    // direction.
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Direction-based afterglow: the colour depends only on where the camera
 * looks (elevation and heading relative to the sun), so the sky has no edges
 * in any shot. Warm peach under the sun, cooler lilac away from it.
 */
export const skyFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMiddle;
  uniform vec3 uHorizon;
  uniform vec3 uAwayMiddle;
  uniform vec3 uAwayHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunPosition;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    vec3 toSun = normalize(uSunPosition - cameraPosition);
    vec2 sunHeading = normalize(toSun.xz);
    // At the zenith the heading is undefined; fall back to the sun heading
    // so no pixel can turn NaN (bloom would spread it over the frame).
    float planar = length(dir.xz);
    vec2 heading = planar > 1e-4 ? dir.xz / planar : sunHeading;
    float cosAz = dot(heading, sunHeading);
    float sinAz = heading.x * sunHeading.y - heading.y * sunHeading.x;
    float azimuth = atan(sinAz, cosAz);
    float warm = smoothstep(0.0, 1.0, cosAz * 0.5 + 0.5);

    // Elevation ramp, matched to the old flat backdrop seen from the car.
    float t = clamp(0.3 + dir.y * 1.05, 0.0, 1.0);
    vec3 horizon = mix(uAwayHorizon, uHorizon, warm);
    vec3 middle = mix(uAwayMiddle, uMiddle, warm);
    vec3 color = mix(horizon, middle, smoothstep(0.0, 0.42, t));
    color = mix(color, uTop, smoothstep(0.42, 0.95, t));

    // Afterglow band that hugs the horizon, strongest under the sun.
    float band = exp(-dir.y * dir.y * 140.0) * warm * warm;
    color += uGlow * band * 0.18;

    // Warm glow around the sun, stretched horizontally.
    vec2 d = vec2(azimuth * 0.375, (dir.y - toSun.y) * 1.8);
    float glow = exp(-dot(d, d) * 22.0);
    color += uGlow * glow * 0.55;

    gl_FragColor = vec4(color, 1.0);
  }
`;

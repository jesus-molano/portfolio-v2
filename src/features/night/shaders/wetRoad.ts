/**
 * Wet asphalt at night. The street is dark violet; every light source
 * (`uLights`, up to six) is mirrored by the water film as a long streak
 * running from below the light toward the camera, where the reflected ray
 * meets the road. The puddle mask makes the streaks break up. Lane lines
 * run along +x (the street's direction). Fog as everywhere else.
 */
export const WET_ROAD_LIGHTS = 6;

export const wetRoadVertexShader = /* glsl */ `
  varying vec3 vWorld;
  varying float vFogDepth;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const wetRoadFragmentShader = /* glsl */ `
  #define LIGHTS ${WET_ROAD_LIGHTS}
  uniform vec3 uBase;
  uniform vec3 uLine;
  uniform vec3 uLightPos[LIGHTS];
  uniform vec3 uLightColor[LIGHTS];
  uniform float uLightLevel[LIGHTS];
  uniform float uKerbNear;
  uniform float uKerbFar;
  uniform float uWet;
  uniform float uCarX;
  uniform vec3 uHeadColor;
  uniform float uHeadLevel;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec3 vWorld;
  varying float vFogDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    float grain = noise(p * 3.1) * 0.5 + noise(p * 11.7) * 0.25;
    vec3 color = uBase * (0.82 + 0.36 * grain);
    // Puddles: patches where the film is thicker and the mirror sharper.
    float puddle = smoothstep(0.48, 0.72, noise(p * 0.23 + 7.0) * 0.7 + noise(p * 0.9) * 0.3);
    float wet = uWet * (0.45 + 0.55 * puddle);

    // Centre line, dashed, along x.
    float dash = step(0.5, fract(vWorld.x / 6.0));
    float centre = (1.0 - smoothstep(0.06, 0.09, abs(vWorld.z + 1.75))) * dash;
    // Edge lines just inside each kerb.
    float edge = (1.0 - smoothstep(0.05, 0.08, abs(vWorld.z - (uKerbNear - 0.3))))
      + (1.0 - smoothstep(0.05, 0.08, abs(vWorld.z - (uKerbFar + 0.3))));
    color = mix(color, uLine, clamp(centre + edge, 0.0, 1.0) * 0.55);

    vec3 view = cameraPosition - vWorld;
    for (int i = 0; i < LIGHTS; i++) {
      float level = uLightLevel[i];
      if (level <= 0.0) continue;
      vec3 L = uLightPos[i];
      // The light's mirror image under the road; the streak lies on the ground
      // under the segment from the camera to it, so it runs toward the viewer.
      vec3 M = vec3(L.x, -L.y, L.z);
      vec2 a = M.xz;
      vec2 b = cameraPosition.xz;
      vec2 ab = b - a;
      float abLen2 = max(dot(ab, ab), 1e-4);
      float t = clamp(dot(p - a, ab) / abLen2, 0.0, 1.0);
      vec2 closest = a + ab * t;
      float across = length(p - closest);
      // Narrow across, long along; tighter in the puddles.
      float width = mix(0.55, 0.22, puddle) * (1.0 + t * 0.6);
      float streak = exp(-(across * across) / (width * width));
      // Brightest near the point below the light, fading toward the camera.
      float along = exp(-t * 3.2) * smoothstep(0.0, 0.03, t + 0.02);
      float dist = length(p - L.xz);
      float pool = exp(-dist * dist / 9.0) * 0.35;
      color += uLightColor[i] * level * (streak * along * wet * 1.6 + pool);
    }

    // The headlights' fans: each widens ahead of its lamp and fades with distance.
    float ahead = vWorld.x - (uCarX + 2.1);
    if (ahead > 0.0 && uHeadLevel > 0.0) {
      float spread = 0.45 + ahead * 0.3;
      float left = (vWorld.z + 0.62) / spread;
      float right = (vWorld.z - 0.62) / spread;
      float fan = exp(-left * left) + exp(-right * right);
      float reach = smoothstep(0.0, 1.2, ahead) * exp(-ahead * 0.16);
      color += uHeadColor * uHeadLevel * fan * reach * (0.35 + 0.65 * wet);
    }

    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
  }
`;

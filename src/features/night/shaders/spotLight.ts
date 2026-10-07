import type { IUniform, MeshStandardMaterial } from "three";

/**
 * The police helicopter's searchlight over the Logixs wall (searchlight.ts),
 * as light any of the set's surfaces can take: the wall and the bills
 * (pasteUp.ts) and, through `litBySearchlight`, the standard materials in
 * its pool (the pavement under the bills, the plinth, the cornice over the
 * brick, the balconies), so the pool breaks onto the pavement and over the
 * cornice instead of stopping at the wall's edges.
 *
 * `spotLight(world)` is how much of the lamp reaches a point, before the
 * surface's albedo: a hot core, an even body that dims a little toward its
 * edge, cut crisp at the rim (the lamp's lens), and a faint scatter around
 * it. uSpotAxis is unit (set on the CPU); behind the lamp the share is huge
 * and the light nothing. uSpotColor is black when the light is off, so it is
 * the same program either way: nothing recompiles when it comes on.
 */
export const spotLightGlsl = /* glsl */ `
  uniform vec3 uSpotFrom;
  uniform vec3 uSpotAxis;
  uniform float uSpotTan;
  uniform vec3 uSpotColor;

  vec3 spotLight(vec3 world) {
    vec3 d = world - uSpotFrom;
    float along = dot(d, uSpotAxis);
    vec3 across = d - uSpotAxis * along;
    float s = length(across) / max(along * uSpotTan, 1e-3);
    float body = (1.0 - smoothstep(0.88, 1.0, s)) * (1.0 - 0.3 * s * s);
    float core = exp(-s * s * 7.0);
    float spill = exp(-s * s * 0.6) * 0.05;
    return uSpotColor * (0.55 * body + 1.1 * core + spill);
  }
`;

export type SpotUniforms = {
  uSpotFrom: IUniform;
  uSpotAxis: IUniform;
  uSpotTan: IUniform;
  uSpotColor: IUniform;
};

/**
 * A standard material lit by the searchlight too, on top of its own lights:
 * the spot as direct diffuse light, Lambert from the beam's direction and
 * measured against the wall's own facing (the wall takes the spot whole),
 * so the pavement under a steep beam takes more and a face turned from it
 * none. The uniform objects are shared with the caller, which writes them
 * every frame. One cache key for every such material: the same code, so a
 * warm-up compiles it once per variant (instanced or not).
 */
export function litBySearchlight<M extends MeshStandardMaterial>(material: M, uniforms: SpotUniforms): M {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
  varying vec3 vVaSpotWorld;
  varying vec3 vVaSpotNormal;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
  vec4 vaSpotPosition = vec4( transformed, 1.0 );
  vec3 vaSpotNormal = objectNormal;
  #ifdef USE_INSTANCING
    vaSpotPosition = instanceMatrix * vaSpotPosition;
    vaSpotNormal = mat3( instanceMatrix ) * vaSpotNormal;
  #endif
  vVaSpotWorld = ( modelMatrix * vaSpotPosition ).xyz;
  vVaSpotNormal = mat3( modelMatrix ) * vaSpotNormal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
  varying vec3 vVaSpotWorld;
  varying vec3 vVaSpotNormal;
  ${spotLightGlsl}`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
  {
    vec3 vaN = vVaSpotNormal / max( length( vVaSpotNormal ), 1e-4 );
    float vaFacing = clamp( dot( vaN, -uSpotAxis ) / max( -uSpotAxis.z, 0.2 ), 0.0, 2.0 );
    reflectedLight.directDiffuse += material.diffuseContribution * spotLight( vVaSpotWorld ) * vaFacing;
  }`,
      );
  };
  material.customProgramCacheKey = () => "va-searchlight";
  return material;
}

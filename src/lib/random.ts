/**
 * Deterministic pseudo-random generator (mulberry32) for stable layouts:
 * every palm, window, star and poster placed with it lands in the same
 * place on every visit, so screenshots stay stable. It lived in the hero
 * scene's world.ts, which builds three.js vectors as it loads, and the
 * cinema's marquee and STATS's achievement tree imported it from there,
 * bringing three.js into the page's first bundle. world.ts re-exports it;
 * moved as it was, so every sequence is the same (random.test.ts).
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

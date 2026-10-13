/** Deterministic hashing and random numbers, so the same seed gives the same bytes. */

/** FNV-1a 32-bit hash of a string. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small fast PRNG. Returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable per-handle integer seed. Handles are things like `t1.2` or `actor.t1.citizen`. */
export function seedFor(seed: number, handle: string): number {
  const n = fnv1a(`${seed}:${handle}`) % 2147483647;
  return n === 0 ? 1 : n;
}

/** A stable per-handle random generator. */
export function rngFor(seed: number, handle: string): () => number {
  return mulberry32(seedFor(seed, handle));
}

/** A stable Excalidraw element id for a handle. Looks random, is not. */
export function elementId(seed: number, handle: string): string {
  const a = fnv1a(`id:${seed}:${handle}`).toString(36);
  const b = fnv1a(`id2:${handle}:${seed}`).toString(36);
  return `${a}${b}`;
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

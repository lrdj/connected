import type { Box, Pt } from "./types.js";

export const cx = (b: Box): number => b.x + b.w / 2;
export const cy = (b: Box): number => b.y + b.h / 2;
export const right = (b: Box): number => b.x + b.w;
export const bottom = (b: Box): number => b.y + b.h;

/** Where a point sits on a box, as width and height ratios. Excalidraw's fixedPoint. */
export function ratioOf(b: Box, p: Pt): Pt {
  return [clamp01((p[0] - b.x) / b.w), clamp01((p[1] - b.y) / b.h)];
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * A right-angled route from box a to box b.
 * Straight if the boxes overlap in x or y, otherwise an L. By default it
 * leaves a vertically and arrives at b horizontally; `first: "h"` flips that.
 * Points are absolute.
 */
export function routeL(a: Box, b: Box, first: "v" | "h" = "v"): Pt[] {
  const ox0 = Math.max(a.x, b.x);
  const ox1 = Math.min(right(a), right(b));
  const oy0 = Math.max(a.y, b.y);
  const oy1 = Math.min(bottom(a), bottom(b));

  if (ox1 - ox0 > 12) {
    const x = (ox0 + ox1) / 2;
    return b.y >= bottom(a) ? [[x, bottom(a)], [x, b.y]] : [[x, a.y], [x, bottom(b)]];
  }
  if (oy1 - oy0 > 12) {
    const y = (oy0 + oy1) / 2;
    return b.x >= right(a) ? [[right(a), y], [b.x, y]] : [[a.x, y], [right(b), y]];
  }
  if (first === "h") {
    const y = cy(a);
    const x = cx(b);
    const startX = b.x > a.x ? right(a) : a.x;
    const endY = b.y > a.y ? b.y : bottom(b);
    return [[startX, y], [x, y], [x, endY]];
  }
  const x = cx(a);
  const y = cy(b);
  const startY = b.y > a.y ? bottom(a) : a.y;
  const endX = b.x > a.x ? b.x : right(b);
  return [[x, startY], [x, y], [endX, y]];
}

/** Does a polyline pass through a box? Endpoints touching the edge don't count. */
export function polylineCrossesBox(points: Pt[], b: Box, inset = 2): boolean {
  const x0 = b.x + inset, y0 = b.y + inset, x1 = right(b) - inset, y1 = bottom(b) - inset;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const sx0 = Math.min(ax, bx), sx1 = Math.max(ax, bx);
    const sy0 = Math.min(ay, by), sy1 = Math.max(ay, by);
    if (sx1 < x0 || sx0 > x1 || sy1 < y0 || sy0 > y1) continue;
    return true;
  }
  return false;
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return a.x < right(b) + gap && right(a) + gap > b.x && a.y < bottom(b) + gap && bottom(a) + gap > b.y;
}

export function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(right(a), right(b)) - x, h: Math.max(bottom(a), bottom(b)) - y };
}

/** Size of a caption drawn under an actor, matching the renderers (80% of the label size). */
export function captionSize(caption: string, style: { fontSize: number; charWidth: number; lineHeight: number }): { w: number; h: number } {
  const fontSize = Math.round(style.fontSize * 0.8);
  return { w: Math.round(caption.length * style.charWidth * fontSize), h: Math.round(fontSize * style.lineHeight) + 4 };
}

/** An actor's footprint for routing and collisions: the icon plus its caption, if any. */
export function actorFootprint(box: Box, caption: string | undefined, style: { fontSize: number; charWidth: number; lineHeight: number }): Box {
  if (!caption) return box;
  const c = captionSize(caption, style);
  const x = Math.min(box.x, box.x + (box.w - c.w) / 2);
  return { x: Math.round(x), y: box.y, w: Math.round(Math.max(box.w, c.w)), h: box.h + c.h };
}

/** Where a burst's spikes reach, so other things keep clear. Matches burstOutline. */
export function burstFootprint(box: Box): Box {
  const rx = (box.w / 2) * 1.42 * 1.36 + 3;
  const ry = (box.h / 2) * 1.42 * 1.36 + 3;
  return { x: Math.round(cx(box) - rx), y: Math.round(cy(box) - ry), w: Math.round(rx * 2), h: Math.round(ry * 2) };
}

export function bbox(points: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * A jagged star outline around a box, for bursts. Absolute points, closed.
 * The inner points sit on an ellipse that clears the box corners (semi-axes
 * at least sqrt(2) times the half-extents), so the spikes never cut the text.
 */
export function burstOutline(box: Box, rng: () => number): Pt[] {
  const centreX = cx(box);
  const centreY = cy(box);
  const innerX = (box.w / 2) * 1.42 + 2;
  const innerY = (box.h / 2) * 1.42 + 2;
  const perimeter = Math.PI * (innerX + innerY);
  const spikes = Math.max(8, Math.min(20, Math.round(perimeter / 40)));
  const pts: Pt[] = [];
  const n = spikes * 2;
  for (let i = 0; i < n; i++) {
    const outer = i % 2 === 0;
    const theta = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.15;
    const k = outer ? 1.18 + rng() * 0.18 : 0.98 + rng() * 0.05;
    pts.push([
      Math.round(centreX + Math.cos(theta) * innerX * k),
      Math.round(centreY + Math.sin(theta) * innerY * k),
    ]);
  }
  return pts;
}

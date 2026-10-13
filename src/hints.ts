/**
 * Hints: positions pinned from a hand-edited Excalidraw file, kept in
 * hints.yml next to the scenario so they survive a rebuild.
 *
 *   pin   reads the edited file, finds each element by its stable id, and
 *         records what moved, resized or was deleted
 *   build applies those, re-routes any link touching a moved thing, and
 *         keeps links the user drew by hand exactly as they were
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { actorFootprint, bottom, right } from "./geometry.js";
import { bestRoute, bubbleFootprint } from "./layout.js";
import type { LayoutWarning } from "./layout.js";
import { elementId } from "./rng.js";
import type { Box, BoxHint, Hints, LinkHint, Pt, RenderContext, Sketch, SketchLink } from "./types.js";

export function hintsPath(dir: string): string {
  return path.join(path.resolve(dir), "hints.yml");
}

export function loadHints(dir: string): Hints | undefined {
  const file = hintsPath(dir);
  if (!fs.existsSync(file)) return undefined;
  return (yaml.load(fs.readFileSync(file, "utf8")) ?? {}) as Hints;
}

function footprintOf(sketch: Sketch, handle: string, ctx: RenderContext): Box | undefined {
  const b = sketch.bubbles.find((x) => x.handle === handle);
  if (b) return bubbleFootprint(b);
  const a = sketch.actors.find((x) => x.handle === handle);
  return a ? actorFootprint(a.box, a.caption, ctx.style) : undefined;
}

/** Grow the canvas to hold everything, including anything hints pushed outside it. */
export function fitCanvas(sketch: Sketch, margin: number): void {
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  const take = (b: Box): void => {
    minX = Math.min(minX, b.x - margin); minY = Math.min(minY, b.y - margin);
    maxX = Math.max(maxX, right(b) + margin); maxY = Math.max(maxY, bottom(b) + margin);
  };
  sketch.bubbles.forEach((b) => take(bubbleFootprint(b)));
  sketch.actors.forEach((a) => take(a.box));
  sketch.links.forEach((l) => l.points.forEach(([x, y]) => take({ x, y, w: 0, h: 0 })));
  sketch.canvas = {
    x: Math.round(minX), y: Math.round(minY),
    width: Math.round(Math.max(sketch.canvas.width, maxX) - minX),
    height: Math.round(maxY - minY),
  };
}

export function applyHints(sketch: Sketch, hints: Hints | undefined, ctx: RenderContext, warnings: LayoutWarning[]): void {
  if (!hints) return;
  const moved = new Set<string>();
  const unknown = (what: string, handle: string): void => {
    warnings.push({ kind: "hint-unknown", message: `hints.yml names ${what} "${handle}", which this build does not have; it was ignored` });
  };

  for (const [handle, h] of Object.entries(hints.bubbles ?? {})) {
    const b = sketch.bubbles.find((x) => x.handle === handle);
    if (!b) { unknown("bubble", handle); continue; }
    Object.assign(b.box, pick(h));
    moved.add(handle);
  }
  for (const [handle, h] of Object.entries(hints.actors ?? {})) {
    const a = sketch.actors.find((x) => x.handle === handle);
    if (!a) { unknown("actor", handle); continue; }
    Object.assign(a.box, pick(h));
    moved.add(handle);
  }

  const removed = new Set(hints.remove ?? []);
  for (const handle of removed) {
    if (!sketch.actors.some((a) => a.handle === handle) && !sketch.links.some((l) => l.handle === handle)) unknown("element", handle);
  }
  sketch.actors = sketch.actors.filter((a) => !removed.has(a.handle));
  sketch.links = sketch.links.filter((l) => !removed.has(l.handle) && !removed.has(l.from) && !removed.has(l.to));

  // Re-route links that touch something that moved, unless the link itself is pinned.
  const obstacles = [...sketch.bubbles.map(bubbleFootprint), ...sketch.actors.map((a) => actorFootprint(a.box, a.caption, ctx.style))];
  for (const l of sketch.links) {
    if (hints.links?.[l.handle]) continue;
    if (!moved.has(l.from) && !moved.has(l.to)) continue;
    const a = footprintOf(sketch, l.from, ctx);
    const b = footprintOf(sketch, l.to, ctx);
    if (!a || !b) continue;
    const best = bestRoute(a, b, obstacles.filter((o) => !sameBox(o, a) && !sameBox(o, b)));
    if (best.crossings > 0) warnings.push({ kind: "link-crosses", message: `link ${l.handle} passes through another box after applying hints` });
    l.points = best.pts;
  }
  for (const [handle, h] of Object.entries(hints.links ?? {})) {
    const l = sketch.links.find((x) => x.handle === handle);
    if (!l) { unknown("link", handle); continue; }
    l.points = h.points.map(([x, y]) => [x, y]);
    if (h.start) l.startRatio = [h.start[0], h.start[1]];
    if (h.end) l.endRatio = [h.end[0], h.end[1]];
  }

  fitCanvas(sketch, ctx.style.clusterGap);
}

const sameBox = (a: Box, b: Box): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function pick(h: BoxHint): Partial<Box> {
  const out: Partial<Box> = {};
  if (h.x !== undefined) out.x = h.x;
  if (h.y !== undefined) out.y = h.y;
  if (h.w !== undefined) out.w = h.w;
  if (h.h !== undefined) out.h = h.h;
  return out;
}

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  points?: Pt[];
  startBinding?: { fixedPoint?: Pt } | null;
  endBinding?: { fixedPoint?: Pt } | null;
}

/**
 * Compare a hand-edited Excalidraw file with what `build` produces and
 * return the hints that reproduce the edits. `current` is the sketch with the
 * existing hints already applied, i.e. what the user opened and edited.
 */
export function pinFromFile(file: string, current: Sketch, existing: Hints | undefined, ctx: RenderContext, warnings: LayoutWarning[]): Hints {
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as { elements?: ExcalidrawElement[] };
  const byId = new Map((data.elements ?? []).filter((e) => !e.isDeleted).map((e) => [e.id, e]));
  const hints: Hints = {
    bubbles: { ...(existing?.bubbles ?? {}) },
    actors: { ...(existing?.actors ?? {}) },
    links: { ...(existing?.links ?? {}) },
    remove: [...(existing?.remove ?? [])],
  };
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.75;
  let changes = 0;

  const boxHint = (box: Box, el: ExcalidrawElement): BoxHint | undefined => {
    const h: BoxHint = {};
    if (!near(el.x, box.x) || !near(el.y, box.y)) { h.x = Math.round(el.x); h.y = Math.round(el.y); }
    if (!near(el.width, box.w) || !near(el.height, box.h)) { h.w = Math.round(el.width); h.h = Math.round(el.height); }
    return Object.keys(h).length ? h : undefined;
  };

  for (const b of current.bubbles) {
    const el = byId.get(elementId(ctx.seed, b.handle));
    if (!el) { warnings.push({ kind: "pin", message: `bubble ${b.handle} was deleted in the file; delete its line in scenario.txt instead` }); continue; }
    const h = boxHint(b.box, el);
    if (h) { hints.bubbles![b.handle] = { ...hints.bubbles![b.handle], ...h }; changes++; }
  }
  for (const a of current.actors) {
    const el = byId.get(elementId(ctx.seed, a.handle));
    if (!el) { if (!hints.remove!.includes(a.handle)) { hints.remove!.push(a.handle); changes++; } continue; }
    const h = boxHint(a.box, el);
    if (h) { hints.actors![a.handle] = { ...hints.actors![a.handle], ...h }; changes++; }
  }

  // Apply the box changes and re-route, so a link that merely followed a box is not pinned.
  const rerouted: Sketch = JSON.parse(JSON.stringify(current)) as Sketch;
  applyHints(rerouted, { bubbles: hints.bubbles, actors: hints.actors, remove: hints.remove, links: existing?.links }, ctx, []);

  for (const l of rerouted.links) {
    const el = byId.get(elementId(ctx.seed, l.handle));
    if (!el) { if (!hints.remove!.includes(l.handle)) { hints.remove!.push(l.handle); changes++; } continue; }
    const points: Pt[] = (el.points ?? []).map(([x, y]) => [Math.round(el.x + x), Math.round(el.y + y)]);
    const same = points.length === l.points.length && points.every((p, i) => near(p[0], l.points[i]![0]) && near(p[1], l.points[i]![1]));
    if (same) continue;
    const h: LinkHint = { points };
    if (el.startBinding?.fixedPoint) h.start = [round3(el.startBinding.fixedPoint[0]), round3(el.startBinding.fixedPoint[1])];
    if (el.endBinding?.fixedPoint) h.end = [round3(el.endBinding.fixedPoint[0]), round3(el.endBinding.fixedPoint[1])];
    hints.links![l.handle] = h;
    changes++;
  }

  warnings.push({ kind: "pin", message: `${changes} change${changes === 1 ? "" : "s"} recorded` });
  return tidy(hints);
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function tidy(h: Hints): Hints {
  const out: Hints = {};
  if (h.bubbles && Object.keys(h.bubbles).length) out.bubbles = h.bubbles;
  if (h.actors && Object.keys(h.actors).length) out.actors = h.actors;
  if (h.links && Object.keys(h.links).length) out.links = h.links;
  if (h.remove?.length) out.remove = h.remove;
  return out;
}

export function saveHints(dir: string, hints: Hints): string {
  const file = hintsPath(dir);
  const body = Object.keys(hints).length
    ? `# Positions pinned from a hand-edited Excalidraw file. Edit freely or delete to start again.\n${yaml.dump(hints, { flowLevel: 3, lineWidth: 120, noCompatMode: true })}`
    : "# No hints. Run `pin` after editing the Excalidraw file to record your changes.\n";
  fs.writeFileSync(file, body);
  return file;
}

export type { SketchLink };

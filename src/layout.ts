/**
 * Layout in two levels. Each thread becomes a cluster: its bubbles stacked
 * as a staircase with the speakers' icons at the ends. Clusters are then
 * packed onto the canvas. No graph layout engine, by design (see BRIEF-v2.md).
 */
import {
  actorFootprint, boxesOverlap, bottom, burstFootprint, polylineCrossesBox, right, routeL, union,
} from "./geometry.js";
import { iconBox } from "./load.js";
import { measureBubble } from "./measure.js";
import { rngFor } from "./rng.js";
import type {
  Box, Pt, RenderContext, Scenario, Sketch, SketchActor, SketchBubble, SketchLink, Thread,
} from "./types.js";

export interface LayoutWarning {
  kind: "link-crosses" | "canvas-grown" | "hint-unknown" | "pin";
  message: string;
}

interface Cluster {
  bubbles: SketchBubble[];
  actors: SketchActor[];
  links: SketchLink[];
  /** Bounding box of everything above, with the origin at 0,0 after normalising. */
  box: Box;
  /** The footprints of everything above, for interlocking packing. */
  parts: Box[];
}

export const bubbleFootprint = (b: SketchBubble): Box => (b.burst ? burstFootprint(b.box) : b.box);

/** The cleanest, then shortest, of four right-angled routes between two footprints. */
export function bestRoute(a: Box, b: Box, obstacles: Box[]): { pts: Pt[]; crossings: number } {
  const candidates: Pt[][] = [
    routeL(a, b, "v"), routeL(a, b, "h"),
    [...routeL(b, a, "v")].reverse(), [...routeL(b, a, "h")].reverse(),
  ];
  const length = (pts: Pt[]): number => pts.slice(1).reduce((sum, p, i) => sum + Math.abs(p[0] - pts[i]![0]) + Math.abs(p[1] - pts[i]![1]), 0);
  const crossings = (pts: Pt[]): number => obstacles.filter((o) => o !== a && o !== b && polylineCrossesBox(pts, o)).length;
  return candidates.map((pts) => ({ pts, crossings: crossings(pts), length: length(pts) }))
    .sort((p, q) => p.crossings - q.crossings || p.length - q.length)[0]!;
}

/** Shared state across threads: `once` actors drawn in an earlier cluster, and stubs still to route to them. */
interface SharedActors {
  instances: Map<string, { handle: string; cluster: number }>;
  pending: Array<{ actorHandle: string; bubbleHandle: string; from: number; to: number }>;
}

/** Lay one thread out around the origin. */
function composeThread(thread: Thread, index: number, scenario: Scenario, ctx: RenderContext, shared: SharedActors): Cluster {
  const { style } = ctx;
  const threadId = `t${index + 1}`;
  const rng = rngFor(ctx.seed, `${threadId}:compose`);
  const actorById = new Map(scenario.actors.map((a) => [a.id, a]));

  // Bubbles: a staircase that steps down and alternately sideways. A turn that
  // answers an earlier bubble steps down from that one instead, on the other
  // side from its first reply, so the thread forks. A turn that answers two
  // bubbles sits below both. Anything that lands on something is nudged clear.
  let direction = rng() < 0.5 ? -1 : 1;
  const bubbles: SketchBubble[] = [];
  const byHandle = new Map<string, SketchBubble>();
  const parentsOf = new Map<string, SketchBubble[]>();
  const childCount = new Map<string, number>();
  thread.turns.forEach((turn, i) => {
    const brng = rngFor(ctx.seed, turn.handle);
    const measured = measureBubble(turn.text, style, brng, turn.burst);
    const angle = (brng() * 2 - 1) * style.angle;
    const parents = turn.replyTo.map((h) => byHandle.get(h)).filter((b): b is SketchBubble => Boolean(b));
    if (!parents.length && i > 0) parents.push(bubbles[i - 1]!);

    let x = 0;
    let y = 0;
    if (parents.length === 1) {
      const parent = parents[0]!;
      const nth = childCount.get(parent.handle) ?? 0;
      childCount.set(parent.handle, nth + 1);
      const side = nth === 0 ? direction : -direction;
      const step = parent.box.w * (0.3 + rng() * 0.3);
      x = parent.box.x + side * step;
      y = bottom(parent.box) + style.turnGap + Math.round(rng() * style.turnGap);
      // Mostly keep going the same way, sometimes turn back, like a wandering line.
      if (nth === 0 && rng() < 0.3) direction = -direction;
    } else if (parents.length > 1) {
      const lowest = Math.max(...parents.map((p) => bottom(p.box)));
      const centre = parents.reduce((sum, p) => sum + p.box.x + p.box.w / 2, 0) / parents.length;
      x = centre - measured.w / 2;
      y = lowest + style.turnGap + Math.round(rng() * style.turnGap);
    }

    const bubble: SketchBubble = {
      handle: turn.handle, text: turn.text, burst: turn.burst, speaker: turn.speaker,
      measured, angle, box: { x: Math.round(x), y: Math.round(y), w: measured.w, h: measured.h },
    };
    const taken = bubbles.map(bubbleFootprint);
    for (let tries = 1; tries <= 60 && taken.some((t) => boxesOverlap(bubbleFootprint(bubble), t, style.turnGap / 2)); tries++) {
      // Push sideways in widening steps, then start stepping down as well.
      const sideways = (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 24;
      bubble.box.x = Math.round(x + sideways);
      bubble.box.y = Math.round(y + Math.max(0, tries - 24) * 12);
    }
    bubbles.push(bubble);
    byHandle.set(turn.handle, bubble);
    parentsOf.set(turn.handle, parents);
  });

  // Actors: one instance per distinct node, beside the first turn that hangs
  // off it. Try the side away from the previous bubble first, then the other
  // side, then above and below, taking the first spot that hits nothing.
  // A `once` actor drawn in an earlier thread is not drawn again; its stub is
  // routed after packing.
  const actors: SketchActor[] = [];
  const links: SketchLink[] = [];
  const seen = new Set<string>();
  thread.turns.forEach((turn, i) => {
    const b = bubbles[i]!;
    if (seen.has(turn.node)) return;
    seen.add(turn.node);
    const decl = actorById.get(turn.node)!;
    const icon = ctx.icons[decl.icon];
    if (!icon) throw new Error(`actor "${decl.id}" uses icon "${decl.icon}", which is not in the template`);

    const existing = decl.once ? shared.instances.get(decl.id) : undefined;
    if (existing) {
      shared.pending.push({ actorHandle: existing.handle, bubbleHandle: b.handle, from: existing.cluster, to: index });
      return;
    }

    const size = iconBox(icon, style);
    const caption = decl.caption;
    const prev = parentsOf.get(b.handle)?.[0];
    const preferred = i === 0 ? (direction > 0 ? -1 : 1) : prev && prev.box.x > b.box.x ? -1 : 1;
    const gap = style.turnGap + Math.round(rng() * style.turnGap);
    const lift = Math.round(size.h * 0.35) - Math.round(rng() * size.h * 0.3);
    const target = bubbleFootprint(b);
    const footW = actorFootprint({ x: 0, y: 0, ...size }, caption, style).w;
    const footH = actorFootprint({ x: 0, y: 0, ...size }, caption, style).h;
    const candidates: Box[] = [];
    for (const side of [preferred, -preferred]) {
      const ax = side < 0 ? target.x - gap - size.w - Math.max(0, (footW - size.w) / 2) : right(target) + gap + Math.max(0, (footW - size.w) / 2);
      candidates.push({ x: Math.round(ax), y: target.y - lift, ...size });
    }
    candidates.push({ x: target.x + Math.round((target.w - size.w) / 2), y: target.y - gap - footH, ...size });
    candidates.push({ x: target.x + Math.round((target.w - size.w) / 2), y: bottom(target) + gap, ...size });
    const taken: Box[] = [
      ...bubbles.map(bubbleFootprint),
      ...actors.map((o) => actorFootprint(o.box, o.caption, style)),
    ];
    const free = candidates.find((c) => !taken.some((t) => boxesOverlap(actorFootprint(c, caption, style), t, 4)));
    const box = free ?? candidates[0]!;
    const actor: SketchActor = {
      handle: decl.once ? `actor.${decl.id}` : `actor.${threadId}.${decl.id}`,
      actorId: decl.id, icon: decl.icon,
      ...(caption ? { caption } : {}),
      box,
    };
    actors.push(actor);
    if (decl.once) shared.instances.set(decl.id, { handle: actor.handle, cluster: index });
    links.push({
      handle: `stub.${actor.handle}.${b.handle}`, from: actor.handle, to: b.handle, kind: "stub",
      points: routeL(actorFootprint(actor.box, caption, style), b.box),
    });
  });

  for (const b of bubbles) {
    for (const parent of parentsOf.get(b.handle) ?? []) {
      links.push({ handle: `link.${parent.handle}.${b.handle}`, from: parent.handle, to: b.handle, kind: "turn", points: routeL(parent.box, b.box) });
    }
  }

  // Normalise to the origin.
  let box = bubbleFootprint(bubbles[0]!);
  for (const b of bubbles) box = union(box, bubbleFootprint(b));
  for (const a of actors) box = union(box, actorFootprint(a.box, a.caption, style));
  // Copies, because the footprint helpers hand back the original box when there is nothing to inflate.
  const parts = [...bubbles.map(bubbleFootprint), ...actors.map((a) => actorFootprint(a.box, a.caption, style))].map((b) => ({ ...b }));
  const cluster: Cluster = { bubbles, actors, links, box, parts };
  shift(cluster, -box.x, -box.y);
  return cluster;
}

function shift(c: Cluster, dx: number, dy: number): void {
  for (const b of c.bubbles) { b.box.x += dx; b.box.y += dy; }
  for (const a of c.actors) { a.box.x += dx; a.box.y += dy; }
  for (const l of c.links) l.points = l.points.map(([x, y]) => [x + dx, y + dy] as Pt);
  for (const p of c.parts) { p.x += dx; p.y += dy; }
  c.box.x += dx;
  c.box.y += dy;
}

/**
 * Bottom-left packing in authoring order, by actual footprints rather than
 * bounding boxes, so staircases interlock like the reference. Each cluster
 * takes the free spot with the smallest y, then x. A cluster cross-linked to
 * one already placed takes the free spot nearest that one instead. Then a
 * little seeded jitter where it hits nothing.
 */
interface Affinity {
  from: number;
  to: number;
  /** When set, the later cluster is pulled towards this actor's icon rather than the cluster's centre. */
  actorHandle?: string;
}

function pack(clusters: Cluster[], affinities: Affinity[], ctx: RenderContext, warnings: LayoutWarning[]): { width: number; height: number } {
  const { style } = ctx;
  const rng = rngFor(ctx.seed, "pack");
  const gap = style.clusterGap;
  const margin = gap;
  const width = style.canvas.width;
  const step = 16;
  const placed: Cluster[] = [];
  const placedParts: Box[] = [];

  const fitsAt = (c: Cluster, x: number, y: number): boolean => {
    if (x < margin || y < margin || x + c.box.w + margin > width) return false;
    const dx = x - c.box.x;
    const dy = y - c.box.y;
    return !c.parts.some((part) => {
      const moved = { x: part.x + dx, y: part.y + dy, w: part.w, h: part.h };
      return placedParts.some((o) => boxesOverlap(moved, o, gap));
    });
  };

  clusters.forEach((c, index) => {
    const affinity = affinities.find((a) => (a.from === index && a.to < index) || (a.to === index && a.from < index));
    let anchor: Pt | undefined;
    if (affinity) {
      const partner = placed[affinity.from === index ? affinity.to : affinity.from]!;
      const actor = affinity.actorHandle ? partner.actors.find((a) => a.handle === affinity.actorHandle) : undefined;
      anchor = actor
        ? [actor.box.x + actor.box.w / 2, actor.box.y + actor.box.h / 2]
        : [partner.box.x + partner.box.w / 2, partner.box.y + partner.box.h / 2];
    }
    const maxY = placedParts.reduce((m, p) => Math.max(m, bottom(p)), 0) + gap;

    let spot: Pt | undefined;
    if (anchor) {
      // Measure from the point on this cluster that will carry the link, which
      // for a shared actor is the first bubble that hangs off it.
      const carrier = affinity?.actorHandle ? c.bubbles[0]!.box : c.box;
      let best = Infinity;
      for (let y = margin; y <= maxY + c.box.h; y += step) {
        for (let x = margin; x + c.box.w + margin <= width; x += step) {
          if (!fitsAt(c, x, y)) continue;
          const d = Math.hypot(x - c.box.x + carrier.x + carrier.w / 2 - anchor[0], y - c.box.y + carrier.y + carrier.h / 2 - anchor[1]);
          if (d < best) { best = d; spot = [x, y]; }
        }
      }
    } else {
      scan: for (let y = margin; y <= maxY + c.box.h; y += step) {
        for (let x = margin; x + c.box.w + margin <= width; x += step) {
          if (fitsAt(c, x, y)) { spot = [x, y]; break scan; }
        }
      }
    }
    if (!spot) spot = [margin, maxY]; // wider than the canvas; nothing fits beside it
    shift(c, spot[0] - c.box.x, spot[1] - c.box.y);
    placed.push(c);
    placedParts.push(...c.parts);
  });

  // Jitter, so rows and columns don't line up too neatly.
  for (const c of placed) {
    const dx = Math.round((rng() - 0.5) * gap);
    const dy = Math.round((rng() - 0.5) * gap);
    const others = placed.filter((p) => p !== c).flatMap((p) => p.parts);
    const clear = c.parts.every((part) => !others.some((o) => boxesOverlap({ x: part.x + dx, y: part.y + dy, w: part.w, h: part.h }, o, gap / 2)));
    if (clear && c.box.x + dx >= margin / 2 && c.box.y + dy >= margin / 2 && right(c.box) + dx <= width - margin / 2) shift(c, dx, dy);
  }

  const height = placedParts.reduce((m, p) => Math.max(m, bottom(p)), 0) + margin;
  if (height > style.canvas.height * 1.15) {
    warnings.push({ kind: "canvas-grown", message: `content needs ${height}px of height; canvas was ${style.canvas.height}px. Try a wider canvas, tighter density or fewer threads.` });
  }
  // The configured height is a target, not a frame: sparse content gets a shorter canvas.
  return { width, height: Math.max(height, 300) };
}

export function layoutScenario(scenario: Scenario, ctx: RenderContext): { sketch: Sketch; warnings: LayoutWarning[] } {
  const warnings: LayoutWarning[] = [];
  const shared: SharedActors = { instances: new Map(), pending: [] };
  const clusters = scenario.threads.map((t, i) => composeThread(t, i, scenario, ctx, shared));
  const threadOf = new Map<string, number>();
  scenario.threads.forEach((t, i) => t.turns.forEach((turn) => threadOf.set(turn.handle, i)));
  const affinities: Affinity[] = [
    ...scenario.links.map(([a, b]) => ({ from: threadOf.get(a)!, to: threadOf.get(b)! })),
    ...shared.pending.map((p) => ({ from: p.from, to: p.to, actorHandle: p.actorHandle })),
  ];
  const canvas = pack(clusters, affinities, ctx, warnings);

  const bubbles = clusters.flatMap((c) => c.bubbles);
  const actors = clusters.flatMap((c) => c.actors);
  const links = clusters.flatMap((c) => c.links);
  const byHandle = new Map(bubbles.map((b) => [b.handle, b]));
  const actorByHandle = new Map(actors.map((a) => [a.handle, a]));
  const obstacles: Box[] = [...bubbles.map(bubbleFootprint), ...actors.map((a) => actorFootprint(a.box, a.caption, ctx.style))];

  /** Route between two footprints, avoiding every other box if any bend allows it. */
  const routeAcross = (a: Box, b: Box, what: string, kind: SketchLink["kind"], handle: string, from: string, to: string): void => {
    const best = bestRoute(a, b, obstacles);
    if (best.crossings > 0) warnings.push({ kind: "link-crosses", message: `${what} passes through another box; move one of them by hand` });
    links.push({ handle, from, to, kind, points: best.pts });
  };

  for (const [from, to] of scenario.links) {
    const a = byHandle.get(from)!;
    const b = byHandle.get(to)!;
    routeAcross(obstacles[bubbles.indexOf(a)]!, obstacles[bubbles.indexOf(b)]!, `link ${from} ~ ${to}`, "cross", `cross.${from}.${to}`, from, to);
  }
  for (const p of shared.pending) {
    const actor = actorByHandle.get(p.actorHandle)!;
    const b = byHandle.get(p.bubbleHandle)!;
    routeAcross(obstacles[bubbles.length + actors.indexOf(actor)]!, obstacles[bubbles.indexOf(b)]!, `stub from ${actor.actorId} to ${p.bubbleHandle}`, "stub", `stub.${p.actorHandle}.${p.bubbleHandle}`, p.actorHandle, p.bubbleHandle);
  }

  return { sketch: { bubbles, actors, links, canvas: { x: 0, y: 0, ...canvas } }, warnings };
}

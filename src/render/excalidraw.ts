/**
 * Excalidraw renderer. Writes the `.excalidraw` JSON format, version 2.
 * Field names checked against packages/element/src/types.ts in the Excalidraw
 * repo (October 2026): bindings are { elementId, fixedPoint, mode }, text binds
 * through containerId, images reference `files` by fileId.
 */
import { iconSvg } from "../load.js";
import { bbox, burstOutline, ratioOf } from "../geometry.js";
import { elementId, fnv1a, rngFor, seedFor } from "../rng.js";
import type { Box, Pt, RenderContext, Sketch, SketchBubble, SketchLink } from "../types.js";

type Json = Record<string, unknown>;

const FONT_EXCALIFONT = 5;
const BOUND_TEXT_PADDING = 5;

function baseElement(id: string, seed: number, box: Box, ctx: RenderContext, extra: Json): Json {
  return {
    id,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    angle: 0,
    strokeColor: ctx.style.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: ctx.style.strokeWidth,
    strokeStyle: "solid",
    roundness: null,
    roughness: ctx.style.roughness,
    opacity: 100,
    seed,
    version: 1,
    versionNonce: (seed * 7919) % 2147483647,
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1,
    created: null,
    link: null,
    locked: false,
    ...extra,
  };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

interface Built {
  elements: Json[];
  files: Record<string, Json>;
  /** Shape element id by sketch handle, for binding arrows. */
  shapeByHandle: Map<string, Json>;
}

function buildBubble(b: SketchBubble, ctx: RenderContext, out: Built): void {
  const rectId = elementId(ctx.seed, b.handle);
  const textId = elementId(ctx.seed, `${b.handle}:text`);
  const angle = degToRad(b.angle);
  // A burst is three elements, so group them to drag as one.
  const groupIds = b.burst ? [elementId(ctx.seed, `${b.handle}:group`)] : [];

  const rect = baseElement(rectId, seedFor(ctx.seed, b.handle), b.box, ctx, {
    type: "rectangle",
    angle,
    groupIds,
    boundElements: [{ id: textId, type: "text" }],
    ...(b.burst ? { strokeColor: "transparent" } : {}),
  });

  const m = b.measured;
  const textBox: Box = {
    x: b.box.x + (b.box.w - m.textW) / 2,
    y: b.box.y + (b.box.h - m.textH) / 2,
    w: Math.max(m.textW, b.box.w - 2 * BOUND_TEXT_PADDING),
    h: m.textH,
  };
  textBox.x = b.box.x + (b.box.w - textBox.w) / 2;
  const text = baseElement(textId, seedFor(ctx.seed, `${b.handle}:text`), textBox, ctx, {
    type: "text",
    angle,
    groupIds,
    fontSize: ctx.style.fontSize,
    fontFamily: FONT_EXCALIFONT,
    baseFontSize: null,
    text: m.lines.join("\n"),
    originalText: b.text.toUpperCase(),
    textAlign: "center",
    verticalAlign: "middle",
    containerId: rectId,
    autoResize: true,
    lineHeight: ctx.style.lineHeight,
  });

  out.elements.push(rect, text);
  out.shapeByHandle.set(b.handle, rect);

  if (b.burst) {
    const pts = burstOutline(b.box, rngFor(ctx.seed, `${b.handle}:burst`));
    const closed: Pt[] = [...pts, pts[0]!];
    const box = bbox(closed);
    const origin = closed[0]!;
    const line = baseElement(elementId(ctx.seed, `${b.handle}:burst`), seedFor(ctx.seed, `${b.handle}:burst`), { ...box, x: origin[0], y: origin[1] }, ctx, {
      type: "line",
      groupIds,
      points: closed.map(([x, y]) => [x - origin[0], y - origin[1]]),
      polygon: true,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    });
    out.elements.push(line);
  }
}

function buildActor(a: Sketch["actors"][number], ctx: RenderContext, out: Built): void {
  const icon = ctx.icons[a.icon];
  if (!icon) throw new Error(`No icon "${a.icon}" in template (actor ${a.actorId})`);
  const svg = iconSvg(icon);
  const fileId = `icon-${a.icon}-${fnv1a(svg).toString(16)}`;
  if (!out.files[fileId]) {
    out.files[fileId] = {
      mimeType: "image/svg+xml",
      id: fileId,
      dataURL: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
      created: 1,
    };
  }
  // Images cannot carry bound text, so an actor and its caption are grouped instead.
  const groupIds = a.caption ? [elementId(ctx.seed, `${a.handle}:group`)] : [];
  const image = baseElement(elementId(ctx.seed, a.handle), seedFor(ctx.seed, a.handle), a.box, ctx, {
    type: "image",
    groupIds,
    fileId,
    status: "saved",
    scale: [1, 1],
    crop: null,
  });
  out.elements.push(image);
  out.shapeByHandle.set(a.handle, image);

  if (a.caption) {
    const caption = a.caption.toUpperCase();
    const fontSize = Math.round(ctx.style.fontSize * 0.8);
    const w = Math.round(caption.length * ctx.style.charWidth * fontSize);
    const h = Math.round(fontSize * ctx.style.lineHeight);
    const box: Box = { x: a.box.x + (a.box.w - w) / 2, y: a.box.y + a.box.h + 4, w, h };
    out.elements.push(
      baseElement(elementId(ctx.seed, `${a.handle}:caption`), seedFor(ctx.seed, `${a.handle}:caption`), box, ctx, {
        type: "text",
        groupIds,
        fontSize,
        fontFamily: FONT_EXCALIFONT,
        baseFontSize: null,
        text: caption,
        originalText: caption,
        textAlign: "center",
        verticalAlign: "top",
        containerId: null,
        autoResize: true,
        lineHeight: ctx.style.lineHeight,
      }),
    );
  }
}

function buildLink(l: SketchLink, ctx: RenderContext, out: Built): void {
  const id = elementId(ctx.seed, l.handle);
  const origin = l.points[0]!;
  const box = bbox(l.points);
  const from = out.shapeByHandle.get(l.from);
  const to = out.shapeByHandle.get(l.to);
  if (!from || !to) throw new Error(`Link ${l.handle} refers to unknown handle ${from ? l.to : l.from}`);

  const binding = (shape: Json, p: Pt, pinned?: Pt) => ({
    elementId: shape.id as string,
    fixedPoint: pinned ?? ratioOf({ x: shape.x as number, y: shape.y as number, w: shape.width as number, h: shape.height as number }, p),
    mode: "orbit",
  });

  const arrow = baseElement(id, seedFor(ctx.seed, l.handle), { ...box, x: origin[0], y: origin[1] }, ctx, {
    type: "arrow",
    points: l.points.map(([x, y]) => [x - origin[0], y - origin[1]]),
    startBinding: binding(from, origin, l.startRatio),
    endBinding: binding(to, l.points[l.points.length - 1]!, l.endRatio),
    startArrowhead: null,
    endArrowhead: null,
    elbowed: false,
  });
  out.elements.push(arrow);
  for (const shape of [from, to]) {
    const bound = (shape.boundElements as Json[] | null) ?? [];
    shape.boundElements = [...bound, { id, type: "arrow" }];
  }
}

export function renderExcalidraw(sketch: Sketch, ctx: RenderContext): Json {
  const out: Built = { elements: [], files: {}, shapeByHandle: new Map() };
  for (const b of sketch.bubbles) buildBubble(b, ctx, out);
  for (const a of sketch.actors) buildActor(a, ctx, out);
  for (const l of sketch.links) buildLink(l, ctx, out);
  return {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/connected-sketch",
    elements: out.elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: 20,
      gridStep: 5,
      gridModeEnabled: false,
    },
    files: out.files,
  };
}

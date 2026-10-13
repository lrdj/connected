/**
 * SVG renderer using Rough.js. Draws the same geometry as the Excalidraw
 * output, with Excalifont embedded as a data URL so the file is self-contained.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../load.js";
import roughModule from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core.js";
import type { RoughGenerator } from "roughjs/bin/generator.js";

// roughjs ships a CommonJS bundle whose default export is the API object; the
// typings describe it as a default export, so bridge the two here.
const rough = roughModule as unknown as { generator(): RoughGenerator };
import { burstOutline } from "../geometry.js";
import { rngFor, seedFor } from "../rng.js";
import type { RenderContext, Sketch } from "../types.js";

/** Excalifont (SIL OFL 1.1), the Latin subsets, as @font-face rules with embedded data. */
function fontFaces(): string {
  const dir = path.join(ROOT, "fonts", "Excalifont");
  const faces: Array<[string, string]> = [
    ["Excalifont-Regular-latin.woff2", "U+20-7e,U+a0-ff,U+2013-2014,U+2018-201a,U+201c-201e,U+2026,U+20ac"],
    ["Excalifont-Regular-latin-ext.woff2", "U+100-17e,U+192,U+1fc-1ff,U+218-21b"],
  ];
  return faces
    .map(([file, range]) => {
      const data = fs.readFileSync(path.join(dir, file)).toString("base64");
      return `@font-face{font-family:Excalifont;font-style:normal;font-weight:400;unicode-range:${range};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
    })
    .join("\n");
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSvg(sketch: Sketch, ctx: RenderContext): string {
  const gen = rough.generator();
  const { style } = ctx;
  const parts: string[] = [];

  const strokeOptions = (handle: string): Options => ({
    roughness: style.roughness,
    bowing: style.bowing,
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    seed: seedFor(ctx.seed, handle),
    disableMultiStroke: true,
  });

  const emit = (d: Drawable): void => {
    for (const p of gen.toPaths(d)) {
      parts.push(`<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? "none"}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  };

  parts.push(`<rect x="${sketch.canvas.x}" y="${sketch.canvas.y}" width="${sketch.canvas.width}" height="${sketch.canvas.height}" fill="#ffffff"/>`);

  for (const l of sketch.links) {
    emit(gen.linearPath(l.points, strokeOptions(l.handle)));
  }

  for (const b of sketch.bubbles) {
    const { box, measured: m } = b;
    const centreX = box.x + box.w / 2;
    const centreY = box.y + box.h / 2;
    parts.push(`<g transform="rotate(${b.angle.toFixed(2)} ${centreX} ${centreY})">`);
    if (b.burst) {
      emit(gen.polygon(burstOutline(box, rngFor(ctx.seed, `${b.handle}:burst`)), strokeOptions(`${b.handle}:burst`)));
    } else {
      emit(gen.rectangle(box.x, box.y, box.w, box.h, strokeOptions(b.handle)));
    }
    const lineH = style.fontSize * style.lineHeight;
    const firstBaseline = centreY - (m.lines.length * lineH) / 2 + lineH * 0.78;
    const tspans = m.lines
      .map((line, i) => `<tspan x="${centreX}" y="${(firstBaseline + i * lineH).toFixed(1)}">${esc(line)}</tspan>`)
      .join("");
    parts.push(`<text class="label" text-anchor="middle">${tspans}</text>`);
    parts.push("</g>");
  }

  for (const a of sketch.actors) {
    const svgPath = ctx.icons[a.icon]?.file;
    if (!svgPath) throw new Error(`No icon "${a.icon}" in template (actor ${a.actorId})`);
    const data = Buffer.from(fs.readFileSync(svgPath, "utf8"), "utf8").toString("base64");
    parts.push(`<image href="data:image/svg+xml;base64,${data}" x="${a.box.x}" y="${a.box.y}" width="${a.box.w}" height="${a.box.h}"/>`);
    if (a.caption) {
      parts.push(`<text class="label caption" text-anchor="middle" x="${a.box.x + a.box.w / 2}" y="${a.box.y + a.box.h + style.fontSize * 0.9}">${esc(a.caption.toUpperCase())}</text>`);
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sketch.canvas.x} ${sketch.canvas.y} ${sketch.canvas.width} ${sketch.canvas.height}" width="${sketch.canvas.width}" height="${sketch.canvas.height}">`,
    `<style>${fontFaces()}\n.label{font-family:Excalifont,"Comic Sans MS","Chalkboard SE",cursive;font-size:${style.fontSize}px;fill:${style.strokeColor};letter-spacing:0.02em}.caption{font-size:${Math.round(style.fontSize * 0.8)}px}</style>`,
    ...parts,
    "</svg>",
  ].join("\n");
}

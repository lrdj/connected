/**
 * Placeholder icons. An actor declared with `?name` (or `?name:wide`,
 * `?name:tall`) gets a labelled dashed box in place of a drawing, so a
 * scenario can be written and judged before the icons exist. If the template
 * later gains an icon called `name`, `?name` resolves to it and the
 * placeholder disappears without an edit to the scenario.
 */
import fs from "node:fs";
import path from "node:path";
import type { ActorDecl, IconInfo, RenderContext } from "./types.js";

export type PlaceholderShape = "square" | "tall" | "wide";

export interface Placeholder {
  /** The icon name without the `?`, e.g. `border-control-post`. */
  name: string;
  shape: PlaceholderShape;
  /** The words drawn in the box. */
  label: string;
  /** Natural size in template units, before actorSize or iconScale is applied. */
  w: number;
  h: number;
  svg: string;
}

/** Natural sizes, chosen so that a square placeholder matches a 64px icon. */
const SIZES: Record<PlaceholderShape, { w: number; h: number }> = {
  square: { w: 64, h: 64 },
  tall: { w: 40, h: 64 },
  wide: { w: 120, h: 64 },
};

const TOKEN = /^\?([A-Za-z0-9_-]+)(?::(square|tall|wide))?$/;

export function isPlaceholderToken(icon: string): boolean {
  return icon.startsWith("?");
}

export function parsePlaceholder(icon: string): { name: string; shape: PlaceholderShape } {
  const m = icon.match(TOKEN);
  if (!m) throw new Error(`"${icon}" is not a placeholder icon; expected ?name, ?name:tall or ?name:wide`);
  return { name: m[1]!, shape: (m[2] as PlaceholderShape | undefined) ?? "square" };
}

/** Wrap a label into lines of at most `max` characters, breaking on spaces. */
function wrapLabel(label: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of label.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function makePlaceholder(icon: string, strokeColor = "#1e1e1e"): Placeholder {
  const { name, shape } = parsePlaceholder(icon);
  const { w, h } = SIZES[shape];
  const label = name.replace(/[-_]+/g, " ").toUpperCase();
  // Wrap at the largest size that fits, then shrink so the longest line fits too.
  const charWidth = 0.62;
  const inner = w - 10;
  let fontSize = 10;
  const lines = wrapLabel(label, Math.max(4, Math.floor(inner / (fontSize * charWidth))));
  const longest = Math.max(...lines.map((l) => l.length));
  fontSize = Math.min(fontSize, Math.max(6, Math.floor(inner / (longest * charWidth))));
  const lineH = fontSize * 1.2;
  const firstBaseline = h / 2 - (lines.length * lineH) / 2 + lineH * 0.8;
  const tspans = lines
    .map((l, i) => `<tspan x="${w / 2}" y="${(firstBaseline + i * lineH).toFixed(1)}">${esc(l)}</tspan>`)
    .join("");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`,
    `  <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" stroke-dasharray="4 3"/>`,
    `  <text text-anchor="middle" stroke="none" fill="${strokeColor}" font-family="Excalifont,'Comic Sans MS','Chalkboard SE',cursive" font-size="${fontSize}" letter-spacing="0.02em">${tspans}</text>`,
    `</svg>`,
    "",
  ].join("\n");
  return { name, shape, label, w, h, svg };
}

/**
 * Resolve every `?name` icon in the actor list. A name the template has is
 * used directly; the rest become generated placeholders registered in
 * `ctx.icons` under their full token. Returns the placeholders in use.
 */
export function resolvePlaceholders(actors: ActorDecl[], ctx: RenderContext): Placeholder[] {
  const made = new Map<string, Placeholder>();
  for (const a of actors) {
    if (!isPlaceholderToken(a.icon)) continue;
    const { name } = parsePlaceholder(a.icon);
    if (ctx.icons[name]) {
      a.icon = name;
      continue;
    }
    if (!ctx.icons[a.icon]) {
      const p = makePlaceholder(a.icon, ctx.style.strokeColor);
      const info: IconInfo = { svg: p.svg, w: p.w, h: p.h, placeholder: true };
      ctx.icons[a.icon] = info;
      made.set(a.icon, p);
    }
  }
  return [...made.values()];
}

/** Write the generated SVGs somewhere a person can trace over them at the right proportions. */
export function writePlaceholders(placeholders: Placeholder[], dir: string): string[] {
  if (!placeholders.length) return [];
  fs.mkdirSync(dir, { recursive: true });
  return placeholders.map((p) => {
    const file = path.join(dir, `${p.name}.svg`);
    fs.writeFileSync(file, p.svg);
    return file;
  });
}

export function describePlaceholders(placeholders: Placeholder[]): string {
  return placeholders.map((p) => `${p.name} (${p.shape})`).join(", ");
}

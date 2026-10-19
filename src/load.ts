import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { IconInfo, RenderContext, Style } from "./types.js";

interface TemplateFile {
  name?: string;
  icons?: Record<string, string>;
  stroke?: { roughness?: number; strokeWidth?: number; bowing?: number; color?: string };
  font?: { size?: number; lineHeight?: number; charWidth?: number };
  wrap?: number;
  angle?: number;
  padding?: { min?: number; max?: number };
  actorSize?: number;
  iconScale?: number;
  density?: Record<string, { clusterGap?: number; turnGap?: number }>;
}

interface ConfigFile {
  template?: string;
  seed?: number;
  canvas?: { width?: number; ratio?: string | number };
  density?: string;
  wrap?: number;
  angle?: number;
  stroke?: TemplateFile["stroke"];
  font?: TemplateFile["font"];
  padding?: TemplateFile["padding"];
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function readYaml<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  const parsed = yaml.load(fs.readFileSync(file, "utf8"));
  return (parsed ?? {}) as T;
}

function parseRatio(ratio: string | number | undefined): number {
  if (ratio === undefined) return 4 / 3;
  if (typeof ratio === "number") return ratio;
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) throw new Error(`Bad canvas ratio "${ratio}", expected e.g. 4:3`);
  return w / h;
}

/** Read config.yml from an example directory and the template it names. Config wins over template. */
export function loadContext(dir: string): RenderContext {
  const exampleDir = path.resolve(dir);
  const config = readYaml<ConfigFile>(path.join(exampleDir, "config.yml"));
  const templateName = config.template ?? "govuk-services";
  const templateDir = path.join(ROOT, "templates", templateName);
  const template = readYaml<TemplateFile>(path.join(templateDir, "template.yml"));

  const densityName = config.density ?? "medium";
  const density = template.density?.[densityName];
  if (!density) throw new Error(`Template "${templateName}" has no density preset "${densityName}"`);

  const width = config.canvas?.width ?? 1600;
  const style: Style = {
    roughness: config.stroke?.roughness ?? template.stroke?.roughness ?? 1,
    strokeWidth: config.stroke?.strokeWidth ?? template.stroke?.strokeWidth ?? 1,
    bowing: config.stroke?.bowing ?? template.stroke?.bowing ?? 1,
    strokeColor: config.stroke?.color ?? template.stroke?.color ?? "#1e1e1e",
    fontSize: config.font?.size ?? template.font?.size ?? 20,
    lineHeight: config.font?.lineHeight ?? template.font?.lineHeight ?? 1.25,
    charWidth: config.font?.charWidth ?? template.font?.charWidth ?? 0.62,
    wrap: config.wrap ?? template.wrap ?? 14,
    angle: config.angle ?? template.angle ?? 1.5,
    padding: {
      min: config.padding?.min ?? template.padding?.min ?? 0.5,
      max: config.padding?.max ?? template.padding?.max ?? 1.0,
    },
    clusterGap: density.clusterGap ?? 26,
    turnGap: density.turnGap ?? 14,
    actorSize: template.actorSize ?? 64,
    ...(template.iconScale !== undefined ? { iconScale: template.iconScale } : {}),
    canvas: { width, height: Math.round(width / parseRatio(config.canvas?.ratio)) },
  };

  const icons: Record<string, IconInfo> = {};
  for (const [name, rel] of Object.entries(template.icons ?? {})) {
    const file = path.join(templateDir, rel);
    if (!fs.existsSync(file)) throw new Error(`Template "${templateName}": icon "${name}" points to missing file ${rel}`);
    icons[name] = { file, ...svgSize(file, name) };
  }

  return { seed: config.seed ?? 1, style, icons, name: path.basename(exampleDir) };
}

/** Natural size of an SVG from its viewBox, falling back to width/height attributes. */
function svgSize(file: string, name: string): { w: number; h: number } {
  const head = fs.readFileSync(file, "utf8").slice(0, 2000);
  const viewBox = head.match(/viewBox\s*=\s*"([^"]+)"/);
  if (viewBox) {
    const parts = viewBox[1]!.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2]! > 0 && parts[3]! > 0) return { w: parts[2]!, h: parts[3]! };
  }
  const w = head.match(/\swidth\s*=\s*"([\d.]+)/);
  const h = head.match(/\sheight\s*=\s*"([\d.]+)/);
  if (w && h) return { w: Number(w[1]), h: Number(h[1]) };
  throw new Error(`Icon "${name}": cannot read a size from ${file} (no viewBox or width/height)`);
}

/** The SVG source of an icon, from its file or inline for a placeholder. */
export function iconSvg(icon: IconInfo): string {
  if (icon.svg !== undefined) return icon.svg;
  if (icon.file) return fs.readFileSync(icon.file, "utf8");
  throw new Error("Icon has neither a file nor inline SVG");
}

/** The drawn size of an icon on the canvas. */
export function iconBox(icon: IconInfo, style: Style): { w: number; h: number } {
  const scale = style.iconScale ?? style.actorSize / icon.h;
  return { w: Math.round(icon.w * scale), h: Math.round(icon.h * scale) };
}

export { ROOT };

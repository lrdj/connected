#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadContext, ROOT } from "./load.js";
import { renderExcalidraw } from "./render/excalidraw.js";
import { renderSvg } from "./render/svg.js";
import { svgToPng } from "./preview.js";
import { parseScenario } from "./parse.js";
import { layoutScenario } from "./layout.js";
import { applyHints, loadHints, pinFromFile, saveHints } from "./hints.js";
import { measureBubble } from "./measure.js";
import { rngFor } from "./rng.js";
import { describePlaceholders, resolvePlaceholders, writePlaceholders } from "./placeholder.js";
import type { Sketch, RenderContext } from "./types.js";

async function writeOutputs(sketch: Sketch, ctx: RenderContext, name: string, png: boolean): Promise<void> {
  const outDir = path.join(ROOT, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const excalidraw = path.join(outDir, `${name}.excalidraw`);
  const svg = path.join(outDir, `${name}.svg`);
  fs.writeFileSync(excalidraw, JSON.stringify(renderExcalidraw(sketch, ctx), null, 2));
  fs.writeFileSync(svg, renderSvg(sketch, ctx));
  console.log(`wrote ${path.relative(process.cwd(), excalidraw)}`);
  console.log(`wrote ${path.relative(process.cwd(), svg)}`);
  if (png) {
    const out = path.join(outDir, `${name}.png`);
    await svgToPng(svg, out);
    console.log(`wrote ${path.relative(process.cwd(), out)}`);
  }
}

function readScenario(dir: string, ctx: RenderContext) {
  const file = path.join(path.resolve(dir), "scenario.txt");
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  try {
    const scenario = parseScenario(fs.readFileSync(file, "utf8"));
    const placeholders = resolvePlaceholders(scenario.actors, ctx);
    for (const a of scenario.actors) {
      if (!ctx.icons[a.icon]) throw new Error(`actor "${a.id}" uses icon "${a.icon}", which template "${ctx.name}" does not have (write ?${a.icon} for a placeholder)`);
    }
    return { scenario, placeholders };
  } catch (err) {
    throw new Error(`${path.relative(process.cwd(), file)}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(argv: string[]): Promise<void> {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [command, dir] = argv.filter((a) => !a.startsWith("--"));
  const png = flags.has("--png");
  switch (command) {
    case "fixture": {
      // The hand-placed sketch used to tune the look, styled by the example's config.
      const ctx = loadContext(dir ?? path.join(ROOT, "examples/govid-tax"));
      const { buildFixture } = await import("../fixtures/milestone1.js");
      await writeOutputs(buildFixture(ctx), ctx, "fixture", png);
      return;
    }
    case "build": {
      if (!dir) throw new Error("usage: build <example dir>");
      const ctx = loadContext(dir);
      const { scenario, placeholders } = readScenario(dir, ctx);
      const { sketch, warnings } = layoutScenario(scenario, ctx);
      applyHints(sketch, loadHints(dir), ctx, warnings);
      for (const w of warnings) console.warn(`warning: ${w.message}`);
      await writeOutputs(sketch, ctx, ctx.name, png);
      if (placeholders.length) {
        const files = writePlaceholders(placeholders, path.join(ROOT, "out", "placeholders"));
        console.log(`placeholder icons still to draw: ${describePlaceholders(placeholders)}`);
        console.log(`wrote ${files.length} placeholder SVG${files.length === 1 ? "" : "s"} to ${path.relative(process.cwd(), path.join(ROOT, "out", "placeholders"))}/`);
      }
      return;
    }
    case "pin": {
      // Record hand edits from an Excalidraw file into hints.yml.
      if (!dir) throw new Error("usage: pin <example dir> [edited.excalidraw]");
      const ctx = loadContext(dir);
      const { scenario } = readScenario(dir, ctx);
      const file = argv.filter((a) => !a.startsWith("--"))[2] ?? path.join(ROOT, "out", `${ctx.name}.excalidraw`);
      if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
      const existing = loadHints(dir);
      const { sketch, warnings } = layoutScenario(scenario, ctx);
      applyHints(sketch, existing, ctx, warnings);
      const hints = pinFromFile(file, sketch, existing, ctx, warnings);
      const out = saveHints(dir, hints);
      for (const w of warnings.filter((x) => x.kind === "pin" || x.kind === "hint-unknown")) console.log(w.message);
      console.log(`wrote ${path.relative(process.cwd(), out)}`);
      return;
    }
    case "check": {
      if (!dir) throw new Error("usage: check <example dir>");
      const ctx = loadContext(dir);
      const { scenario, placeholders } = readScenario(dir, ctx);
      const turns = scenario.threads.flatMap((t) => t.turns);
      const lines = turns.map((t) => measureBubble(t.text, ctx.style, rngFor(ctx.seed, t.handle), t.burst).lines.length);
      const { sketch, warnings } = layoutScenario(scenario, ctx);
      applyHints(sketch, loadHints(dir), ctx, warnings);
      console.log(`${ctx.name}: ${scenario.threads.length} threads, ${turns.length} bubbles (${turns.filter((t) => t.burst).length} bursts), ${scenario.actors.length} actors, ${scenario.links.length} cross-thread links`);
      console.log(`lines per bubble: min ${Math.min(...lines)}, max ${Math.max(...lines)}, mean ${(lines.reduce((a, b) => a + b, 0) / lines.length).toFixed(1)}`);
      if (placeholders.length) console.log(`placeholder icons still to draw: ${describePlaceholders(placeholders)}`);
      for (const w of warnings) console.log(`warning: ${w.message}`);
      return;
    }
    case "preview": {
      // Rasterise any SVG, e.g. a hand-edited one.
      if (!dir) throw new Error("usage: preview <file.svg>");
      const out = dir.replace(/\.svg$/, "") + ".png";
      await svgToPng(dir, out);
      console.log(`wrote ${path.relative(process.cwd(), out)}`);
      return;
    }
    default:
      console.log("usage: node --import tsx src/cli.ts <build|check|pin|fixture|preview> [dir] [file] [--png]");
      process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

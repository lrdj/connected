#!/usr/bin/env node
// Blind-test helper: print measured bounds of parts not yet in spike/parts-meta.yml.
// usage: node spike/blind-test/bounds.mjs 24093 11245 ...
import { partDescription, partGeometry, bounds } from '../ldraw.mjs';
const r1 = (v) => Math.round(v * 10) / 10;
for (const n of process.argv.slice(2)) {
  const file = n.toLowerCase().endsWith('.dat') ? n.toLowerCase() : n.toLowerCase() + '.dat';
  const desc = partDescription(file);
  if (!desc) { console.log(`${n}: not in library`); continue; }
  const b = bounds(partGeometry(file).T);
  console.log(`${n}: ${desc}\n  x [${r1(b.min[0])}, ${r1(b.max[0])}]  y [${r1(b.min[1])}, ${r1(b.max[1])}]  z [${r1(b.min[2])}, ${r1(b.max[2])}]`);
}

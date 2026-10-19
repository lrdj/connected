#!/usr/bin/env node
// Writes vendor/ldraw/parts.lst: one line per library part, "number<TAB>description".
// complete.zip does not ship it, and an agent needs it to grep for parts
// without opening the zip. Takes a few seconds.
//
// usage: node spike/make-parts-lst.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PARTS = path.join(ROOT, 'vendor/ldraw/ldraw/parts');
const OUT = path.join(ROOT, 'vendor/ldraw/parts.lst');
if (!fs.existsSync(PARTS)) {
  console.error(`no library at ${PARTS}; see spike/ldraw.mjs for the fetch command`);
  process.exit(2);
}
const lines = [];
const buf = Buffer.alloc(300);
for (const f of fs.readdirSync(PARTS).sort()) {
  if (!f.toLowerCase().endsWith('.dat')) continue;
  const fd = fs.openSync(path.join(PARTS, f), 'r');
  const n = fs.readSync(fd, buf, 0, 300, 0);
  fs.closeSync(fd);
  const first = buf.toString('utf8', 0, n).split(/\r?\n/)[0].replace(/^0\s*/, '').trim();
  lines.push(`${f}\t${first}`);
}
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`wrote ${OUT}: ${lines.length} parts`);

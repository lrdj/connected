// LDraw library access: index, colours, parsing and flattening to world-space
// geometry. Shared by render.mjs (drawing) and parts-meta.mjs (measuring).
//
// Library layout expected under vendor/ldraw/ldraw/: parts/, parts/s/, p/,
// p/48/, p/8/ and LDConfig.ldr, as unpacked from complete.zip.

import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const LIB = path.join(ROOT, 'vendor/ldraw/ldraw');
export const EDGE_RGB = [27, 27, 27];

if (!fs.existsSync(path.join(LIB, 'LDConfig.ldr'))) {
  console.error(`LDraw library not found at ${LIB}.\nFetch it with:\n  mkdir -p vendor/ldraw && curl -L -o vendor/ldraw/complete.zip https://library.ldraw.org/library/updates/complete.zip && (cd vendor/ldraw && unzip -q complete.zip)`);
  process.exit(2);
}

// ---------------------------------------------------------------- colours
export const colours = new Map();
for (const line of fs.readFileSync(path.join(LIB, 'LDConfig.ldr'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^0 !COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})\s+EDGE\s+(\S+)(.*)$/);
  if (!m) continue;
  const rgb = [0, 2, 4].map((i) => parseInt(m[3].slice(i, i + 2), 16));
  const alpha = (m[5].match(/ALPHA\s+(\d+)/) || [, 255])[1];
  colours.set(Number(m[2]), { name: m[1], rgb, alpha: Number(alpha) });
}

export function rgbOf(code) {
  if (code === 24 || code < 0) return EDGE_RGB;
  const c = colours.get(code);
  if (c) return c.rgb;
  if (code >= 0x2000000) return [(code >> 16) & 255, (code >> 8) & 255, code & 255]; // direct colour 0x2RRGGBB
  return [255, 0, 255];
}

// ---------------------------------------------------------------- index
const index = new Map();
function addDir(dir, prefix) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const lower = f.toLowerCase();
    if (!lower.endsWith('.dat') && !lower.endsWith('.ldr')) continue;
    const key = prefix + lower;
    if (!index.has(key)) index.set(key, path.join(dir, f));
  }
}
addDir(path.join(LIB, 'parts'), '');
addDir(path.join(LIB, 'parts/s'), 's/');
addDir(path.join(LIB, 'p'), '');
addDir(path.join(LIB, 'p/48'), '48/');
addDir(path.join(LIB, 'p/8'), '8/');

/** Add a model's own directory to the lookup, ahead of the library. */
export function addModelDir(dir) {
  const local = new Map();
  for (const f of fs.readdirSync(dir)) {
    const lower = f.toLowerCase();
    if (lower.endsWith('.dat') || lower.endsWith('.ldr')) local.set(lower, path.join(dir, f));
  }
  for (const [k, v] of local) index.set(k, v);
}

/** First header line of a library part, or undefined. */
export function partDescription(name) {
  const p = index.get(name.toLowerCase());
  if (!p) return undefined;
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(300);
  const n = fs.readSync(fd, buf, 0, 300, 0);
  fs.closeSync(fd);
  const first = buf.toString('utf8', 0, n).split(/\r?\n/)[0];
  return first.replace(/^0\s*/, '').trim();
}

// ---------------------------------------------------------------- parsing
// Parsed file: { tris: [{c, p:[[x,y,z]x3]}], lines: [{c, p}], cond: [{p, ctl}], refs: [{c, m, t, file}] }
const cache = new Map();
const inlineFiles = new Map(); // MPD sub-files, keyed lowercase
export const missing = new Set();

export function parseText(text) {
  const out = { tris: [], lines: [], cond: [], refs: [] };
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim().split(/\s+/);
    if (t.length < 2) continue;
    const type = t[0];
    if (type === '1' && t.length >= 15) {
      const n = t.slice(1, 14).map(Number);
      out.refs.push({
        c: n[0],
        t: [n[1], n[2], n[3]],
        m: [n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[12]],
        file: t.slice(14).join(' ').replace(/\\/g, '/').toLowerCase(),
      });
    } else if (type === '2' && t.length >= 8) {
      const n = t.slice(1, 8).map(Number);
      out.lines.push({ c: n[0], p: [[n[1], n[2], n[3]], [n[4], n[5], n[6]]] });
    } else if (type === '3' && t.length >= 11) {
      const n = t.slice(1, 11).map(Number);
      out.tris.push({ c: n[0], p: [[n[1], n[2], n[3]], [n[4], n[5], n[6]], [n[7], n[8], n[9]]] });
    } else if (type === '4' && t.length >= 14) {
      const n = t.slice(1, 14).map(Number);
      const a = [n[1], n[2], n[3]], b = [n[4], n[5], n[6]], c = [n[7], n[8], n[9]], d = [n[10], n[11], n[12]];
      out.tris.push({ c: n[0], p: [a, b, c] }, { c: n[0], p: [a, c, d] });
    } else if (type === '5' && t.length >= 14) {
      const n = t.slice(1, 14).map(Number);
      out.cond.push({ p: [[n[1], n[2], n[3]], [n[4], n[5], n[6]]], ctl: [[n[7], n[8], n[9]], [n[10], n[11], n[12]]] });
    }
  }
  return out;
}

/** Parse a model file. MPD files are split into sub-files; the first is returned. */
export function loadModelFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parts = text.split(/^0 FILE /im);
  if (parts.length <= 1) return parseText(text);
  let first = null;
  for (const chunk of parts.slice(1)) {
    const nl = chunk.indexOf('\n');
    const name = chunk.slice(0, nl).trim().replace(/\\/g, '/').toLowerCase();
    const parsed = parseText(chunk.slice(nl + 1));
    inlineFiles.set(name, parsed);
    if (!first) first = parsed;
  }
  return first;
}

export function getFile(name) {
  if (inlineFiles.has(name)) return inlineFiles.get(name);
  if (cache.has(name)) return cache.get(name);
  const p = index.get(name);
  let parsed;
  if (!p) {
    missing.add(name);
    parsed = { tris: [], lines: [], cond: [], refs: [] };
  } else {
    parsed = parseText(fs.readFileSync(p, 'utf8'));
  }
  cache.set(name, parsed);
  return parsed;
}

// ---------------------------------------------------------------- maths
export const mulMV = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
export const xf = (m, t, v) => { const r = mulMV(m, v); return [r[0] + t[0], r[1] + t[1], r[2] + t[2]]; };
export const mulMM = (a, b) => {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
export const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const inherit = (c, parent) => (c === 16 ? parent : c);

/**
 * Flatten a parsed file into world-space geometry.
 * Returns { T: triangles [{c, p}], L: lines [{p}], C: conditional lines [{p, ctl}] }.
 */
export function flatten(parsed, m = IDENTITY, t = [0, 0, 0], colour = 16) {
  const out = { T: [], L: [], C: [] };
  const walk = (file, m, t, colour, depth) => {
    if (depth > 40) return;
    for (const tr of file.tris) out.T.push({ c: inherit(tr.c, colour), p: tr.p.map((v) => xf(m, t, v)) });
    for (const ln of file.lines) out.L.push({ p: ln.p.map((v) => xf(m, t, v)) });
    for (const cl of file.cond) out.C.push({ p: cl.p.map((v) => xf(m, t, v)), ctl: cl.ctl.map((v) => xf(m, t, v)) });
    for (const r of file.refs) walk(getFile(r.file), mulMM(m, r.m), xf(m, t, r.t), inherit(r.c, colour), depth + 1);
  };
  walk(parsed, m, t, colour, 0);
  return out;
}

/** Axis-aligned bounds of triangles: { min: [x,y,z], max: [x,y,z] }, or null. */
export function bounds(T) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of T) for (const p of t.p) for (let i = 0; i < 3; i++) {
    if (p[i] < min[i]) min[i] = p[i];
    if (p[i] > max[i]) max[i] = p[i];
  }
  return isFinite(min[0]) ? { min, max } : null;
}

/** Flatten one library part at the origin: the geometry of `3626b.dat`, say. */
export function partGeometry(name) {
  return flatten(getFile(name.toLowerCase()));
}

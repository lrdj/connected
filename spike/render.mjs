#!/usr/bin/env node
// Renderer: LDraw model -> three-tone, outlined PNG icon that fills its shape box.
//
// A small software rasteriser in plain Node. No browser, no GPU: the sandbox
// this was written in refuses Chromium a Mach port, so three.js in Playwright
// was not available. Everything drawn comes from LDraw library parts; this
// file only projects and shades them.
//
// usage: node spike/render.mjs spike/nurse.ldr out/spike/nurse.png --shape tall
//   --shape tall|wide|square  the placeholder shape; sets the box (default square)
//   --box <px>      box height in output px (default 192: twice the 96 px the map draws actors at)
//   --pad <px>      clear margin inside the box (default 8)
//   --az <deg>      yaw of the model (default 135: front faces south-west)
//   --el <deg>      camera elevation (default 30: a 2:1 dimetric ground diamond)
//   --line <px>     edge line width in output px (default 1.5)
//   --outline <px>  extra silhouette outline around the whole icon, in output px (default 1)
//   --tones 3|0     three-tone shading (default) or continuous
//   --noshadow      skip the ground shadow
//   --ss <n>        supersample factor (default 3)
//   --light x,y,z   key light in view space (default -0.6,0.55,0.6: front face lit, top mid, near side shadow)
//   --tone-lit/--tone-mid/--tone-shadow <k>  the three tones (default 1.06, 0.93, 0.80); k above 1 tints toward white
//   --palette code=hex,...   colour overrides (default 14=FFD500: a cleaner yellow than LDConfig's #FAC80A)
//
// The build scale of the model (minifig, micro, accessory) is the recipe's
// business; whatever its size in LDraw units it is scaled to fill the box.

import path from 'node:path';
import sharp from 'sharp';
import { EDGE_RGB, rgbOf as libRgb, addModelDir, loadModelFile, flatten, bounds, missing } from './ldraw.mjs';

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--noshadow'].includes(argv[i - 1])));
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const [modelPath, outPath] = positional;
if (!modelPath || !outPath) {
  console.error('usage: node spike/render.mjs <model.ldr> <out.png> [--shape tall|wide|square]');
  process.exit(2);
}
const SHAPE = flag('shape', 'square');
const ASPECT = { tall: 40 / 64, wide: 120 / 64, square: 1 }[SHAPE]; // matches src/placeholder.ts
if (!ASPECT) throw new Error('shape must be tall, wide or square');
const BOX_H = Number(flag('box', 192));
const BOX_W = Math.round(BOX_H * ASPECT);
const PAD = Number(flag('pad', 8));
const AZ = (Number(flag('az', 135)) * Math.PI) / 180;
const EL = (Number(flag('el', 30)) * Math.PI) / 180;
const LINE = Number(flag('line', 1.5));
const OUTLINE = Number(flag('outline', 1));
const TONES = Number(flag('tones', 3));
const SS = Number(flag('ss', 3));
const SHADOW = !flag('noshadow', false);

// ---------------------------------------------------------------- load
const t0 = Date.now();
addModelDir(path.dirname(path.resolve(modelPath)));
const { T, L: Lx, C } = flatten(loadModelFile(path.resolve(modelPath)));
if (missing.size) console.warn('missing parts:', [...missing].join(' '));
console.log(`triangles ${T.length}, lines ${Lx.length}, conditional ${C.length} (${Date.now() - t0} ms)`);
const mb = bounds(T);
if (!mb) throw new Error('nothing to draw');
console.log(`bounds x ${mb.min[0].toFixed(1)}..${mb.max[0].toFixed(1)}  y ${mb.min[1].toFixed(1)}..${mb.max[1].toFixed(1)}  z ${mb.min[2].toFixed(1)}..${mb.max[2].toFixed(1)}`);

// ---------------------------------------------------------------- view
// LDraw is Y-down. Flip to Y-up, yaw about Y, then tilt about X so the camera
// looks down at EL. Result: sx right, sy up, sz towards the viewer (depth).
const cy = Math.cos(AZ), sy_ = Math.sin(AZ), ce = Math.cos(EL), se = Math.sin(EL);
function view(v) {
  const x = v[0], y = -v[1], z = v[2];
  const x1 = x * cy + z * sy_;
  const z1 = -x * sy_ + z * cy;
  return [x1, y * ce - z1 * se, z1 * ce + y * se];
}
const VT = T.map((t) => ({ c: t.c, p: t.p.map(view) }));
const VL = Lx.map((l) => ({ p: l.p.map(view) }));
const VC = C.map((c) => ({ p: c.p.map(view), ctl: c.ctl.map(view) }));

let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
for (const t of VT) for (const p of t.p) {
  if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0];
  if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1];
}

// ---------------------------------------------------------------- fit to box
// Choose output px per LDraw unit so the model, its silhouette and its shadow
// fill the box minus the padding. Shadow proportions match the finish step.
const SHADOW_SIDE = 0.12, SHADOW_BELOW = 0.19; // fractions of model width
const wl = maxx - minx, hl = maxy - miny;
const fitW = BOX_W - 2 * PAD - 2 * OUTLINE, fitH = BOX_H - 2 * PAD - 2 * OUTLINE;
const scale = SHADOW
  ? Math.min(fitW / (wl * (1 + 2 * SHADOW_SIDE)), fitH / (hl + SHADOW_BELOW * wl))
  : Math.min(fitW / wl, fitH / hl);
const S = scale * SS; // raster px per LDU
const MARGIN = 2 + (LINE + OUTLINE) / scale; // LDU, room for lines at the edge
const W = Math.ceil((wl + 2 * MARGIN) * S);
const H = Math.ceil((hl + 2 * MARGIN) * S);
const toPx = (p) => [(p[0] - minx + MARGIN) * S, (maxy - p[1] + MARGIN) * S, p[2]];

// ---------------------------------------------------------------- shading
// One key light from the upper left, in front. Faces are flat; with --tones 3
// the lighting is quantised to lit, mid and shadow, which also tidies the
// facets of cylinders into two or three bands.
const LIGHT = norm(String(flag('light', '-0.6,0.55,0.6')).split(',').map(Number)); // view space: x right, y up, z toward the camera. Front face lit, top mid, near side shadow (changed 20 Oct 2026 from -0.5,0.85,0.3, which left the front in mid tone and figures looking grey)
const AMBIENT = 0.6, DIFFUSE = 0.45;
// --palette 14=FFD500,19=E0C090 overrides LDConfig values for the icon look (the library's yellow is a muted #FAC80A)
const PALETTE = new Map(String(flag('palette', '14=FFD500')).split(',').filter(Boolean).map((e) => { const [k, v] = e.split('='); return [Number(k), [0, 2, 4].map((i) => parseInt(v.replace('#', '').slice(i, i + 2), 16))]; }));
const rgbOf = (code) => PALETTE.get(code) || libRgb(code);
const TONE = { lit: Number(flag('tone-lit', 1.06)), mid: Number(flag('tone-mid', 0.93)), shadow: Number(flag('tone-shadow', 0.80)) };
function norm(v) { const l = Math.hypot(...v) || 1; return v.map((a) => a / l); }
function shade(c, p) {
  const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
  const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
  let n = norm([ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]);
  if (n[2] < 0) n = n.map((a) => -a); // face the camera
  const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  const k = TONES === 3 ? (d >= 0.7 ? TONE.lit : d >= 0.25 ? TONE.mid : TONE.shadow) : AMBIENT + DIFFUSE * d;
  const rgb = rgbOf(c);
  // k above 1 lightens toward white instead of clipping, so a lit face can be brighter than the catalogue colour
  return rgb.map((v) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)))));
}

// ---------------------------------------------------------------- raster
const zbuf = new Float32Array(W * H).fill(-Infinity);
const img = new Uint8ClampedArray(W * H * 4);

function drawTri(tri) {
  const [a, b, c] = tri.p.map(toPx);
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-9) return;
  const col = shade(tri.c, tri.p);
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const inv = 1 / area;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) * inv;
      const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const i = y * W + x;
      if (z <= zbuf[i]) continue;
      zbuf[i] = z;
      img[i * 4] = col[0]; img[i * 4 + 1] = col[1]; img[i * 4 + 2] = col[2]; img[i * 4 + 3] = 255;
    }
  }
}

const LW = LINE * SS; // raster px
const BIAS = 1.2; // LDU: lines sit on surfaces, let them win ties
function drawLine(p0w, p1w) {
  const a = toPx(p0w), b = toPx(p1w);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const r = LW / 2;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 1));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0]) + r + 1));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 1));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1]) + r + 1));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      let t = len2 > 0 ? ((px - a[0]) * dx + (py - a[1]) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = a[0] + t * dx, qy = a[1] + t * dy;
      const d = Math.hypot(px - qx, py - qy);
      if (d > r) continue;
      const z = a[2] + t * (b[2] - a[2]);
      const i = y * W + x;
      if (img[i * 4 + 3] === 0 && d > r - 0.5) continue; // keep silhouettes crisp-ish
      if (z < zbuf[i] - BIAS) continue;
      img[i * 4] = EDGE_RGB[0]; img[i * 4 + 1] = EDGE_RGB[1]; img[i * 4 + 2] = EDGE_RGB[2]; img[i * 4 + 3] = 255;
    }
  }
}

const t1 = Date.now();
for (const t of VT) drawTri(t);
const t2 = Date.now();
for (const l of VL) drawLine(l.p[0], l.p[1]);
let condDrawn = 0;
for (const c of VC) {
  const [p0, p1] = c.p.map(toPx), [c0, c1] = c.ctl.map(toPx);
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const s0 = dx * (c0[1] - p0[1]) - dy * (c0[0] - p0[0]);
  const s1 = dx * (c1[1] - p0[1]) - dy * (c1[0] - p0[0]);
  if (s0 * s1 > 0) { drawLine(c.p[0], c.p[1]); condDrawn++; }
}
console.log(`raster ${W}x${H} at ${scale.toFixed(2)} px/LDU: faces ${t2 - t1} ms, lines ${Date.now() - t2} ms, conditional drawn ${condDrawn}`);

// Silhouette: thicken the outer edge like the hand-cut sprites, by growing the
// alpha mask outwards and filling the new ring with the edge colour.
if (OUTLINE > 0) {
  const r = OUTLINE * SS, r2 = r * r, R = Math.ceil(r);
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = img[i * 4 + 3];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (alpha[i]) continue;
    let hit = false;
    for (let dy = -R; dy <= R && !hit; dy++) {
      const yy = y + dy; if (yy < 0 || yy >= H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx; if (xx < 0 || xx >= W) continue;
        if (dx * dx + dy * dy <= r2 && alpha[yy * W + xx]) { hit = true; break; }
      }
    }
    if (hit) { img[i * 4] = EDGE_RGB[0]; img[i * 4 + 1] = EDGE_RGB[1]; img[i * 4 + 2] = EDGE_RGB[2]; img[i * 4 + 3] = 255; }
  }
}

// ---------------------------------------------------------------- finish
// Crop to content, downsample, add a soft ground shadow, centre in the box.
let cx0 = W, cx1 = -1, cy0 = H, cy1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img[(y * W + x) * 4 + 3]) {
  if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
}
const cw = cx1 - cx0 + 1, ch = cy1 - cy0 + 1;
const model = sharp(Buffer.from(img.buffer), { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: cx0, top: cy0, width: cw, height: ch })
  .resize({ width: Math.max(1, Math.round(cw / SS)), height: Math.max(1, Math.round(ch / SS)), kernel: 'lanczos3' })
  .png();
const { data: modelBuf, info: mi } = await model.toBuffer({ resolveWithObject: true });
let mw = mi.width, mh = mi.height;

// Shadow ellipse under the base. In a dimetric view the base centre sits a
// little above the lowest point on screen, so the ellipse is nudged up.
let composed;
if (SHADOW) {
  const rx = Math.round(mw * 0.52), ry = Math.round(Math.max(6, mw * 0.16));
  const blur = Math.max(2, Math.round(mw * 0.03));
  const padX = Math.round(mw * SHADOW_SIDE), padBottom = ry + blur;
  const cw2 = mw + 2 * padX, ch2 = mh + padBottom;
  const cxs = cw2 / 2, cys = mh - ry * 0.35;
  const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw2}" height="${ch2}">
    <ellipse cx="${cxs}" cy="${cys}" rx="${rx}" ry="${ry}" fill="#000" fill-opacity="0.22"/></svg>`;
  const shadow = await sharp(Buffer.from(shadowSvg)).blur(blur).png().toBuffer();
  composed = await sharp({ create: { width: cw2, height: ch2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: shadow, left: 0, top: 0 }, { input: modelBuf, left: padX, top: 0 }])
    .png().toBuffer();
  mw = cw2; mh = ch2;
} else {
  composed = modelBuf;
}

// Rounding can leave the composed image a pixel or two over the fit area.
const limitW = BOX_W - 2 * PAD, limitH = BOX_H - 2 * PAD;
if (mw > limitW || mh > limitH) {
  const k = Math.min(limitW / mw, limitH / mh);
  const nw = Math.max(1, Math.floor(mw * k)), nh = Math.max(1, Math.floor(mh * k));
  composed = await sharp(composed).resize({ width: nw, height: nh, kernel: 'lanczos3' }).png().toBuffer();
  mw = nw; mh = nh;
}

await sharp({ create: { width: BOX_W, height: BOX_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: composed, left: Math.round((BOX_W - mw) / 2), top: Math.round((BOX_H - mh) / 2) }])
  .png().toFile(outPath);
console.log(`wrote ${outPath} ${BOX_W}x${BOX_H} (content ${mw}x${mh}) in ${Date.now() - t0} ms`);

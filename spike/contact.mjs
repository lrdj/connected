// Contact sheet: the four spike icons beside two existing Nano Banana sprites, at 1:1 pixels.
import fs from 'node:fs';
import sharp from 'sharp';
const sprite = (name) => Buffer.from(fs.readFileSync(`templates/lego/icons/${name}.svg`, 'utf8').match(/base64,([^"']+)/)[1], 'base64');
const cells = [
  ['nurse (spike)', 'out/spike/nurse.png'], ['cow (spike)', 'out/spike/cow.png'],
  ['castle-gatehouse (spike)', 'out/spike/castle-gatehouse.png'], ['toothbrush (spike)', 'out/spike/toothbrush.png'],
  ['cow (existing sprite)', sprite('cow')], ['building (existing sprite)', sprite('building')],
];
const GAP = 24, LABEL = 22, PAD = 16;
const metas = await Promise.all(cells.map(([, src]) => sharp(src).metadata()));
const rowH = Math.max(...metas.map((m) => m.height)) + LABEL;
let x = PAD; const comps = []; const labels = [];
cells.forEach(([label, src], i) => {
  const m = metas[i];
  comps.push({ input: src, left: x, top: PAD + LABEL + (rowH - LABEL - m.height) });
  labels.push(`<text x="${x}" y="${PAD + 15}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#333">${label}</text>`);
  x += m.width + GAP;
});
const W = x - GAP + PAD, H = PAD * 2 + rowH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${labels.join('')}</svg>`;
await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } })
  .composite([...comps, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile('out/spike/contact-sheet.png');
console.log(`wrote out/spike/contact-sheet.png ${W}x${H}`);

# Spike notes: LDraw parts rendered by code

19 Oct 2026. **Postscript, later the same day:** the follow-up in `spike/next-steps-after-spike.md` was taken up. The renderer now shades in three tones and fits every icon to its shape box (`--scale` is gone), `spike/ldraw.mjs` holds the library code, `spike/parts-meta.yml` records part origins, and `docs/lego-recipes.md` is the live guide. The rest of this file is the record of the spike as it was.

 Brief: `Claude-lego-spike-briefing.md`. Everything here is in `spike/` and `out/spike/`; the only change outside is the optional `nurse` icon in `templates/lego`.

## What worked

- **The LDraw library as the source of truth.** `vendor/ldraw/` (gitignored, 146 MB zip, 619 MB unpacked) has every minifig part, patterned heads and torsos, and enough bricks to kit-bash anything. Part numbers were looked up in `vendor/ldraw/parts.lst`, which this spike generates from the part headers because the zip does not ship one.
- **A small software renderer in Node, `spike/render.mjs`.** It parses `.ldr`/`.dat` files directly (sub-parts, primitives, MPD sub-files, LDConfig colours), projects with an orthographic dimetric camera, z-buffers flat-shaded triangles, draws LDraw edge lines and conditional lines, grows a silhouette outline, then crops, downsamples, adds the soft ground shadow and pads to the placeholder aspect with `sharp`. About 360 lines, no browser, no GPU. A minifig renders in roughly 150 ms, the castle in under half a second.
- **Studs, proportions and faces for free.** Patterned heads (`3626bp02`) and torsos (`973p24`, the red cross) render as geometry, so a nurse gets a face and a badge without any drawing.
- **One world scale.** `--scale 1.55` output px per LDraw unit gives a bare minifig of about 165 px, and every other icon follows from the parts' real sizes.
- **The optional step.** `nurse.png` wrapped as `templates/lego/icons/nurse.svg`, listed in `template.yml`, and `@nurse ?nurse:tall` in the alpaca example builds and sits beside its bubble like the hand-cut sprites (`out/spike/nurse-in-map.png`). The scenario change was reverted.

## What did not

- **three.js in headless Chromium.** Not three.js's fault: this sandbox refuses Chromium a Mach port (`bootstrap_check_in ... Permission denied`), for the installed Google Chrome and for Playwright's own headless shell alike, so no browser could start. LDView was not installed and would hit the same wall. The pure-Node renderer was the fallback and took about an hour, within the brief's budget. Outside the sandbox the three.js route should still work; `playwright` and `three` were installed, tried and removed again so `package.json` is unchanged.
- **Assembly offsets from memory.** The MLCad minifig offsets I remembered were right, but LDraw's "right arm" sits at negative X with its peg pointing inward, and I had the sides swapped. The fix was to measure the parts: `render.mjs` prints model-space bounds, which settled every origin question (bar origin at one end, cone and fence origins at the top, head origin at the top of the neck).
- **Posing by hand.** A raised arm moves the hand and whatever it holds, and the hand's clip fixes the plane a held tile can lie in. `spike/pose.mjs` does the maths (arm angle, wrist turn, item in the clip) and prints the three LDraw lines. Without it the nurse would have taken most of the afternoon.
- **A moulded cow.** The library has camels, cats, chicks and horns but no cow, so the cow is brick-built: 2 × 4 body, 1 × 1 legs, 1 × 2 brick head with the eyes pattern, pink plate muzzle, `13564` cow horns. It reads as a toy cow, not as the Nano Banana cow.

## Time per icon once the pipeline was up

| Icon | Kind | Passes | Time | Notes |
|---|---|---|---|---|
| nurse | minifig | 6 | ~45 min | all in the arm, hand and clipboard pose; the template is now reusable |
| cow | brick-built animal | 3 | ~15 min | orientation of the head, then horns |
| castle-gatehouse | kit-bashed building | 3 | ~15 min | portcullis origin, cones instead of round-brick merlons |
| toothbrush | kit-bashed small object | 3 | ~10 min | bar origin, then which head reads better |

With the template and `pose.mjs` in place a second minifig would be a few minutes: change colours, hair, head pattern and item.

## Hardest kind

The **minifig**, because of the pose. Bricks only stack; a figure has nine parts with chained rotations, and the held item depends on all of them. The brick-built animal is the hardest to make *read*: without a mould the cow is a cute block with horns, and more bricks would make it bigger, not more cow-like.

## Style against the existing sprites

See `out/spike/contact-sheet.png`.

- **Matches:** camera (dimetric, facing south-west), flat local colour, dark outline, soft grey shadow, transparent background, Lego proportions and studs. On the map the nurse is indistinguishable in weight from the sprites at a glance.
- **Drifts:** the sprites are *illustrated*: thick, confident outlines that vary in weight, a little shading on curved surfaces, and the artist's liberties (the sprite cow is far bigger than a minifig, with a drawn face). Ours are straight renders: uniform 1.5 px lines plus a 1 px silhouette, faceted cylinders (towers and bars show their segments), and strictly real sizes, so a castle on an 8 × 8 plate is five minifigs wide. The cylinders are the most visible tell.
- **Tiny objects are borderline.** The toothbrush reads as "a rod with a plate on the end" at this size; a 1 × 2 plate head reads slightly better than 1 × 1. Small objects would benefit from a per-shape scale bump, which the brief ruled out for the spike.

## Recommendation

**Go, with changes.**

1. Keep the software renderer rather than the browser route. It is small, deterministic, fast and has no runtime dependencies beyond `sharp`, which the repo already has, and it works in the sandbox where agents actually run.
2. Allow a per-icon scale override for `square` small objects (say ×1.5) so a toothbrush is still legible. Everything else stays at one world scale.
3. Smooth cylinders either by averaging normals within a primitive or by quantising shading into three tones; three-tone would also push the look towards the illustrated sprites.
4. Treat the brick-built animals as a style of their own. If the sprite cow is the bar, animals need either a mould (many exist: horse, pig, cat, chick, cow horn but no cow) or a hand-drawn sprite as now.

## What a `draw` command would need

- `connected draw <example>`: for each `?stem:shape` placeholder without an icon, look for `spike/<stem>.ldr` (or `icons-src/<stem>.ldr`), render it with the fixed settings to `templates/<template>/icons/<stem>.svg` and add it to `template.yml`.
- The LDraw library fetched once into `vendor/ldraw/` on first use, with the CC BY 2.0 credit in the README.
- `render.mjs` and `pose.mjs` moved into `src/`, with the camera, light, scale, line and shadow constants in the template so a different template can draw differently.
- A minifig recipe format thinner than raw LDraw: hair, head pattern, torso pattern, leg colour, arm angle, item. `minifig.ldr` plus `pose.mjs` is already most of it.
- A parts index with descriptions (`parts.lst`) committed or generated, so an agent can grep for parts without opening the zip.
- Two things noticed on the way: `templates/lego/template.yml` still lists `person` and `phone`, whose line-drawing files were removed, so the lego examples do not build until those entries are fixed or the files restored; and the tool already resolves `?name` to a template icon when one exists, which is exactly the hook `draw` needs.

## Files

- `spike/render.mjs`: the renderer. `node spike/render.mjs spike/nurse.ldr out/spike/nurse.png --shape tall --scale 1.55`
- `spike/pose.mjs`: minifig right arm, hand and held item for a given arm angle and wrist turn.
- `spike/minifig.ldr`: the template with slots. `spike/nurse.ldr`, `spike/cow.ldr`, `spike/castle-gatehouse.ldr`, `spike/toothbrush.ldr`: the four test models.
- `spike/contact.mjs`: builds `out/spike/contact-sheet.png` from the four renders and two existing sprites.
- `out/spike/*.png`: the renders, the contact sheet and `nurse-in-map.png`.

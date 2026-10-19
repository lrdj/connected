# Spike: fill `?stem:shape` placeholders from LEGO parts, rendered by code

Written 19 Oct 2026. A time-boxed spike, not an integration. Do not change `templates/lego`, `template.yml` or any scenario until the last optional step.

## Why

Today every placeholder becomes a sprite by hand: Claude writes a brief, a human runs an image model, knocks out the background and cuts the sprite. We want `connected` to make the icon itself, with no image-model API. The style is already set by the Nano Banana sprites in `templates/lego`: Lego minifigure style, dimetric, flat colour with black outline, soft grey ground shadow, transparent background.

The bet: **real LEGO parts plus a code renderer** can hit that style, with correct studs and proportions for free. The rule for the whole universe is *everything is Lego; if an actor cannot be built from parts, the actor's description changes, not the renderer.*

## Never do this

Do not hand-write SVG paths or draw figures freehand in code. Every icon is assembled from library parts and rendered. Do not invent part numbers: look them up in the parts index. Do not report an icon done without having opened the PNG and looked at it.

## Setup

1. Download the LDraw complete library (`https://library.ldraw.org/library/updates/complete.zip`) into `vendor/ldraw/` and gitignore it. It contains `parts/`, `p/`, `LDConfig.ldr` (colours) and `parts.lst` (one line per part: number and description). Parts are CC BY 2.0; a credit line goes in the README when this is integrated.
2. Renderer, in Node to match the repo: three.js `LDrawLoader` in headless Chromium via Playwright, with the library served from a tiny local static server (fetch cannot read `file://`). If headless three.js proves fiddly after an hour, fall back to LDView's command-line snapshot mode and note it.
3. Renderer settings, fixed for every icon:
   - orthographic camera, dimetric 2:1 (azimuth 45°, elevation arctan(½) ≈ 26.6°), model facing south-west, matching the existing sprites
   - flat shading: one directional light from upper left plus ambient, so each face is a solid tint; no smooth normals, no gloss
   - LDraw edge lines on, black, about 1.5px at 2× scale
   - transparent background, PNG at 2× scale
   - one world scale for all icons: a bare minifig renders about 160px tall; crop to content; pad to the shape's aspect (tall / wide / square)
   - soft grey ellipse shadow under the base, added in post with `sharp`

## Minifig template

`spike/minifig.ldr` with slots: head, hair or hat, torso, two arms, two hands, hips, two legs, item in right hand. Get the standard assembly offsets from an LDraw minifig reference (MLCad's minifig generator positions are widely documented) and verify by rendering. Pose for the spike: standing, right arm slightly forward holding the item. Torso and leg colours, hair and item are the only variables.

## Four test icons

Each covers a different kind of actor. Write each as `spike/<stem>.ldr`, render to `out/spike/<stem>.png`.

| Stem | Shape | Kind | Notes |
|---|---|---|---|
| `nurse` | tall | minifig | white torso, dark hair, holding a clipboard or similar part |
| `cow` | tall | moulded animal | grep `parts.lst` for `Animal`; use the moulded cow if present, otherwise brick-build one and say so |
| `castle-gatehouse` | wide | kit-bashed building | two round towers, wall between, portcullis down; castle wall and tower parts exist in the library |
| `toothbrush` | square | kit-bashed small object | a bar plus a 1×1 plate or similar; the test is whether a tiny object still reads |

Loop for each: write the model, render, open the PNG, compare it with the sprites in `templates/lego`, fix, re-render. Stop at good enough; this is a spike.

## Optional last step

If the four look right, wrap `nurse` into `templates/lego/icons/nurse.svg` the same way the existing sprites are wrapped, list it in `template.yml`, add `@nurse ?nurse:tall` to one example scenario, run `build --png` and confirm it sits properly beside its bubble. Revert the scenario change afterwards.

## Report

Write `spike/SPIKE-NOTES.md` with, briefly: what worked; what did not; time per icon once the pipeline was up; which of the four kinds was hardest and why; whether the style matches the existing sprites or where it drifts; a recommendation (go, go with changes, or stop) and what a `draw` command would need. Attach a contact sheet of the four icons next to two existing sprites.

# Next steps after the LDraw spike

Written 19 Oct 2026, after reading `spike/SPIKE-NOTES.md`. Verdict: **go, with changes.** The core bet held: real LEGO parts and a small deterministic Node renderer, with no browser and no image API, and `nurse` sits in a real map at the right weight. This file sets out what to do next, in order.

## Decisions taken

- **Keep the pure-Node renderer.** three.js and headless Chromium are parked. They would need a sandbox exception on every run, and the gain (smooth toon shading, a maintained loader) can mostly be had in the Node renderer. Revisit only for an interactive preview or editor, or for r2 scenes that need cast shadows.
- **Every actor gets the same footprint on the map.** The existing map already works this way: castle, EU Commission, frozen server and two people at desks all fill about the same box. Real-world size is ignored and actors are tokens of equal weight.
- **Build scale varies, output size doesn't.** This follows LEGO's own convention:
  - **minifig scale** for people, animals and everyday props (gate, car, washing machine). Most actors.
  - **microscale** for buildings and big things, LEGO Architecture style: small bricks, no minifigs. This is how the institutions on the programme map are drawn today.
  - **accessory scale** for tiny objects (toothbrush, watch, can opener): a real accessory part rendered large, or a minifig holding it if the actor needs a person behind it.
  The recipe chooses the build scale. The renderer always fits the result to the shape box (tall, wide, square). Drop the ×1.5 small-object override suggested in the notes; fit-to-box replaces it.
- **Work with LEGO's conventions, not against them.** Prefer official parts, the LDConfig palette, standard minifig language (yellow as "anyone", hair, hats and accessories for role) and established build scales. When unsure how to build something, look for how LEGO did build it: the LDraw **Official Model Repository** holds many real sets as model files, and buildings and vehicles should start from an official sub-assembly where one exists.
- **Everything is Lego.** If an actor cannot be built from parts, the actor's description changes, not the renderer.
- **Animals without a mould stay hand-drawn sprites for now.** Use moulds where they exist (horse, pig, cat, chick and others). Brick-built animals read as toys, not as the animal.

## Actions

1. **Check `templates/lego/template.yml` builds.** The spike found `person` and `phone` listed with their files missing. New sprites have since been made by hand. Confirm they are wrapped in `icons/`, that the `template.yml` entries match their stems (including `phone-call` if that is the new name), and that both lego examples build cleanly.
2. **Renderer: shading.** Average normals within curved primitives (cylinders, studs, cones), then quantise lighting to three tones: lit, mid and shadow. This removes the faceted cylinders and moves the look toward the illustrated sprites. Keep the uniform outlines.
3. **Renderer: fit to box.** Scale every render to fill its shape box with consistent padding, whatever its build scale. World scale applies only *within* an icon.
4. **Part metadata.** Most of the spike's passes went on finding part origins. Write that knowledge down once: a `parts-meta.yml` (or similar) beside `parts.lst` with origin, bounds and attachment points for the 50 or so most-used parts (minifig set, common bricks and plates, bars, clips, cones, fences, castle and window parts, microscale favourites). Commit `parts.lst`, or a script that generates it, so a fresh session can grep it without opening the zip.
5. **Recipe conventions doc.** A short `docs/lego-recipes.md` for agents: build-scale rules, fit-to-box, minifig template slots and how `pose.mjs` is used, the "how did LEGO build it" rule with the Official Model Repository, the "everything is Lego" rule, and a reminder to render, open the PNG and fix before calling an icon done.
6. **Blind test.** The spike's icons were briefed in detail and debugged one at a time. The real question is whether a **fresh session** can turn an unseen one-line recipe into an accepted icon quickly. Start a new session with only the docs and metadata from steps 4 and 5, and give it five stems from a new domain (a school):

   | Stem | Shape | Build scale | Recipe |
   |---|---|---|---|
   | `teacher` | tall | minifig | A teacher holding a book or pointer. |
   | `parent` | tall | minifig | A parent with a bag, dressed for the school run. |
   | `school` | wide | micro | A small school building with a clock, a bell tower or a playground fence. |
   | `school-office` | wide | minifig vignette | Two staff at desks with a computer and a phone, like the existing APHA sprite. |
   | `lunchbox` | square | accessory | A lunchbox, legible at map size. |

   Record passes and minutes per icon, and what caused each extra pass. **Go for `draw` if each icon takes about 10 minutes and 3 passes or fewer.** Put the five renders on a contact sheet next to two existing sprites, and a test map with all five in it.
7. **Then build `connected draw <example>`** if the test passes. For each `?stem:shape` placeholder without an icon: read `recipes/<stem>.ldr` (or have the agent write it), render with the fixed settings, wrap it as `templates/<template>/icons/<stem>.svg` and register it in `template.yml`. Move `render.mjs` and `pose.mjs` into `src/`, and put the camera, light, line, shading and shadow constants in the template. Fetch the LDraw library into `vendor/ldraw/` on first use, and add the CC BY 2.0 credit to the README.

## Parked

- three.js, browser rendering and any sandbox changes.
- r2 scenes: composed multi-actor scenes in a context ("kids in school", "ambulance with doctors"). The two- or three-element vignettes in step 6 are the rehearsal.
- Animals without a mould.

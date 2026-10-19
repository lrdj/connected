# Drawing actors from LEGO parts

How to turn a `?stem:shape` placeholder into a rendered icon using real LEGO parts from the LDraw library and the renderer in `spike/`. Written 19 Oct 2026 after the spike recorded in `spike/SPIKE-NOTES.md`. Read this before building an icon; it is short.

## The rule

**New actors are built from parts.** The lego template still holds the hand-drawn Nano Banana sprites made before this method existed; leave them as they are. Every actor added from now on is rendered from LDraw parts by the method below, so the rendered look becomes the norm as the set grows. Do not redraw an old sprite to match, and do not hand-draw a new icon to match the old ones. Agreed 20 Oct 2026.


**Everything is Lego.** If an actor cannot be built from parts, change the description of the actor, not the renderer. Never draw freehand, never hand-write SVG or triangles, never invent a part number. Prefer official parts, the LDConfig colour palette and the standard minifig language: yellow skin means "anyone", and role is carried by hair, hat, torso pattern and what the figure holds.

**Work with LEGO's conventions.** When unsure how to build something, look at how LEGO built it. The LDraw Official Model Repository (omr.ldraw.org) holds real sets as model files. It is a separate download from the parts library, not in `vendor/ldraw/`, and its files are whole sets, so you extract the sub-assembly you need by hand. Buildings and vehicles should start from an official sub-assembly where one exists.

**Render, open, fix.** An icon is not done until you have rendered it, opened the PNG, compared it with the sprites in `templates/lego/icons` and fixed what is wrong. Two or three passes is normal. Budget three; if the fourth pass is not clearly the last, change the recipe rather than keep polishing.

## Build scale

Every actor gets the same footprint on the map: the shape box. Real-world size is ignored; a castle, a nurse and a toothbrush are tokens of equal weight. The recipe therefore picks a **build scale**, and the renderer scales whatever you built to fill the box.

| Build scale | For | How |
|---|---|---|
| **minifig** | people, animals with a mould, everyday props (gate, car, bin) | the minifig template below; props at the size a minifig would use |
| **minifig vignette** | a place where people work: an office, a desk, a stall | two or three elements on an 8 × 8 plate, like the existing `apha-desk` sprite |
| **microscale** | buildings and big things | small bricks, cheese slopes, 1 × 1 round bricks; no minifigs; LEGO Architecture style |
| **accessory** | tiny objects: toothbrush, watch, key | one real accessory part, or a bar plus a plate, rendered large by the fit |

**Shape follows the build, not the real object.** The box is `tall` (40:64), `wide` (120:64) or `square`. A quadruped or a desk is `wide` or `square` even though the animal is "tall" in life; a brick-built cow in a `tall` box fills half of it. Buildings are usually `wide` or `square`. A standing figure is `tall`.

**Animals without a mould stay hand-drawn sprites for now.** Moulds exist for horse, pig, cat, chick, camel, bunny, dog and many birds; grep `parts.lst` for `Animal`. Brick-built animals read as toys, not as the animal.

## Where things are

- `vendor/ldraw/ldraw/`: the LDraw parts library, gitignored. If it is missing, `spike/ldraw.mjs` prints the fetch command. Parts are CC BY 2.0.
- `vendor/ldraw/parts.lst`: one line per part, number and description. Generate it with `node spike/make-parts-lst.mjs`, then grep it: `grep -i 'Minifig Hair' vendor/ldraw/parts.lst`. Descriptions use double spaces around dimensions (`Brick  1 x  2`), so grep loosely.
- `spike/parts-meta.yml`: origin, bounds, size and attachment notes for about 90 common parts. Read a part's entry before placing it. Regenerate with `node spike/parts-meta.mjs` after adding to `spike/parts-list.txt`.
- `spike/minifig.ldr`: the minifig template. `spike/pose.mjs`: arm, hand and held item for a pose.
- `spike/render.mjs`: the renderer. `spike/contact.mjs`: contact sheet beside existing sprites.
- `spike/*.ldr`: the worked examples (nurse, cow, castle-gatehouse, toothbrush).

## LDraw in one paragraph

Units: 20 per stud, 24 per brick height, 8 per plate. **+Y is down**, the front of a part is **−Z**, and `1 x N` parts run along **X**. A line `1 <colour> x y z a b c d e f g h i part.dat` places a part at `x y z` with the 3 × 3 rotation `a..i` (rows). Identity is `1 0 0 0 1 0 0 0 1`. Colour codes come from `LDConfig.ldr`: 0 black, 1 blue, 2 green, 4 red, 14 yellow, 15 white, 19 tan, 71 light bluish grey, 72 dark bluish grey, 13 pink, 308 dark brown; grep `!COLOUR` for the rest. For bricks, plates, tiles, slopes, arches, cones and fences the origin is the **top centre of the body** and the body extends down (+Y), with studs 4 above. So a plate placed at y sits on a brick whose top is at y + 8, and a brick on a baseplate whose top is at 0 goes at y = −24. Minifig arms and hands are placed by `spike/pose.mjs` from the parts' own geometry (`spike/hand.mjs`): the hand's peg sits in the arm's cuff socket, and a held item's bar lies along the hand's grip axis, which at rest runs across the body. Do not copy hand lines from older MLCad-style templates; their hand came out through the front of the forearm and their items sat 90 degrees across the grip. Write the model as `spike/<stem>.ldr` with a comment line per group of parts so the next reader can follow it.

## Minifig recipe

Copy `spike/minifig.ldr` to `spike/<stem>.ldr` and change only:

1. **hair or hat** (slot at `0 -24 0`): any `Minifig Hair` or `Minifig Hat` part **that stays within the head**. The head is 26 wide and ends at y 24 (the chin). Check the part's bounds first: hair should reach no lower than about y 21 and no wider than about ±18 in x. Anything bigger overwhelms the figure at icon size and from the fixed camera it swallows the face: `12890` Long Straight (to y 43), `80834` Nurse Hat with Long Back (to y 36) and `29633` Bob Parted in Middle (to y 32) all fail. Tidy ones that render well: `62711` short bob, `99240` swept back into a bun, `93562` top knot, `13251` knot bun, `15427` ponytail, `15500`, `20877`, `3901`. Role does not come from the hair: the nurse's cap would render black because the part is one colour, so her role is carried by the red cross torso and the bun.

   **The face must be visible from the camera.** Hair sits on the round head stud, so it can be turned. If the first render shows hair over the face (long fringes, off-centre ponytails and swept styles fall on the near side), rotate the hair about Y by 90 or 180 degrees (`-1 0 0 0 1 0 0 0 -1` for 180) and render again. A turn helps when the bulk is to one side; when the fringe itself is the problem, 180 only shows the back of the head, as the `15427` ponytail did in the school office. If the face is still hidden, replace the hair with a smaller part from the list above. Never accept a figure whose eyes cannot be seen.
2. **head pattern**: `3626bp01` grin, `3626bp02` woman, or grep `Minifig Head with`.
3. **torso pattern**: `973` plain or grep `Minifig Torso with` (red cross, stethoscope, overalls, suit, police, chef…). Colour the torso, arms and hands to match.
4. **leg colour**.
5. **the right arm, hand and item**: replace those three lines with the output of

   ```
   node spike/pose.mjs <armDegrees> <item.dat> <itemColour> [itemLength] [armColour] [handColour] [wristDegrees]
   ```

   `armDegrees` swings the arm forward (10 is carrying at the side, 20 a relaxed hold, 50 holding something up). The tile's bottom edge lies along the grip axis, so at `wristDegrees` 0 a board is already face-on to the viewer; `wristDegrees` rolls the hand about its peg if you need the item turned. Give `itemLength` for anything other than a 1 × 2 tile. For a book, a bag hung by its handle or a bar (pen, antenna) use `spike/blind-test/hold.mjs`, which has a mode for each; the bar must run along the grip axis or the hand will cut through it.

The figure faces −Z. The renderer looks from the front-left, so the right arm (−X side) is the near side and lands on the **right** of the image; the left hand at rest is the far one. The item goes in the right hand. Sitting figures use `73200b-f2` in place of hips and legs and a `4079` seat or a 24-high brick behind.

## Vignette, microscale and accessory recipes

- **Vignette.** Start with `41539` (8 × 8 plate) at the origin, top at y = 0. Place furniture on it at y = −24 for bricks, y = −8 for plates. Figures stand on the plate with the hips at y = 32 − 72 = −40 (a standing minifig's feet are 72 below its torso origin; put the torso at `0 -72 0` and keep the template's relative offsets by wrapping the figure in an MPD sub-file). Two figures and a desk is enough; the box is small.
- **Microscale.** Decide what three features say "school" or "hospital" (a bell tower, a cross, a clock, a fence) and build only those. Two or three plates of footprint, 1 × 1 bricks and cheese slopes, one colour for walls, one for roof. No studs on show if tiles are cheap to add.
- **Accessory.** One part, or a bar plus a plate. Lay it diagonally so the dimetric view gives it some depth. If it does not read at box size, change the object, not the scale.

## Render and check

```
node spike/render.mjs spike/<stem>.ldr out/spike/<stem>.png --shape tall|wide|square
node spike/contact.mjs      # edit the cells at the top to include your icon
```

Fixed settings, do not vary them per icon: dimetric camera at yaw 135° and elevation 30°, three-tone flat shading with the key light on the front face (tones 1.06, 0.93, 0.80) and yellow overridden to `#FFD500`, 1.5 px edge lines plus a 1 px silhouette, soft grey shadow, transparent background. The box is 192 px high by default (twice the 96 px the map draws actors at); the template icons are currently rendered with `--box 384` for sharper zooming, at four times the file size. The renderer prints the model's bounds in LDraw units and warns about missing parts; both are worth reading before opening the PNG.

Open the PNG. Check, in this order: is it recognisable at a glance; is it facing front-left; for a figure, can you see the eyes (if not, turn or shrink the hair); are the parts attached (nothing floating, nothing buried); does it fill the box; does it sit on its shadow. Then compare it on the contact sheet with two existing sprites.

## Finishing

Wrap the PNG as an SVG the template can embed: a `viewBox` of the PNG's size around one `<image href="data:image/png;base64,…">` at full size, saved as `templates/lego/icons/<stem>.svg`, and add `<stem>: icons/<stem>.svg` under `icons:` in `templates/lego/template.yml`. The tool resolves `?stem` to a template icon when one exists, so the scenario needs no change. Run `build --png` on an example that uses the stem and look at the map.

## What the renderer is

A software rasteriser in Node (`spike/ldraw.mjs` loads, `spike/render.mjs` draws): no browser, no GPU, no image model. It exists because the sandbox agents work in cannot start Chromium. It is deterministic and fast, about 150 ms for a minifig. Its limits are the look of the output, not what it can draw: uniform line weight and flat tones, against the hand-drawn sprites' varied lines and soft shading.

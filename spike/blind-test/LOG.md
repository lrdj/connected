# Blind test log

Fresh session, 19 Oct 2026. Read `docs/lego-recipes.md` only, then the files it points to as needed.
Started reading the doc at 23:24 BST; started building at the time on the first entry below.

## teacher (tall, minifig)

Started 23:28, finished 23:33. 3 passes.

- Before building: `pose.mjs` only places a tile-shaped item (length along the part's X, face at -Y). A book cover (24093: spine along Y, cover along Z) needs a different rotation, so I wrote `spike/blind-test/hold.mjs`, a copy of the pose maths with `book`, `book-down`, `hang` and `bar` modes. Also wrote `spike/blind-test/bounds.mjs` to measure parts not in `parts-meta.yml` without editing the shared list.
- Pass 1 (arm 35, book rising from the hand, wrist -60): the book sat squarely over the torso and hid the suit and tie. Also misread which hand was which: the near (right, -X) side renders on the *right* of the image; the raised yellow hand I took for the empty right hand was the left hand at rest, far side.
- Pass 2 (arm 15, book hanging below the hand, wrist -60 / 0 / 60): hanging at the side is right; wrist -60 swung it forward and it looked detached, 60 showed it edge-on, 0 covered the right leg.
- Pass 3 (arm 10, wrist -30, plus a comparison with arm 55/70 holding the book up beside the head, which hid the face): arm 10 wrist -30 carried at the side, face to the viewer, torso and glasses clear. Done.
- Gaps: the doc should say which side of the image the right hand lands on; it should say `pose.mjs` is tile-only and how to hold a bar, a book or a bag; `3626bp0i` and `973p18` are not in `parts-meta.yml` but the same placement as the plain parts worked.

## parent (tall, minifig)

Started 23:33, finished 23:35. 1 pass.

- Found `11245` Figure Friends School Bag by grepping `Bag`; its header gives the handle position (`!HELP Handle coordinates: Y=-38, Z=4.5`), which `hold.mjs hang:0,-38,4.5` hangs from the clip of a relaxed arm (10 degrees). Jacket `973p13`, hair `20877`, woman face `3626bp02`.
- Pass 1: the bag hangs from the near hand beside the leg, buckle to the viewer; jacket zip and face clear. Done.
- Gaps: the doc should point at the `!HELP` lines in part files for attachment points, and list a few everyday carried items (bag, suitcase `4449`, cup) alongside the tile.

## school (wide, micro)

Started 23:35, finished 23:37. 2 passes.

- No bell part exists under `Bell`; chose a clock tower (`3245bp07`, 1 x 2 x 2 brick with a clock face pattern) and a lattice fence (`3633`, 1 x 4 x 1). Cheese slope `85984` has its origin at its base (bounds y -15.6..0), the opposite of the doc's "origin at the top centre" rule for slopes; placed it at the top y of the brick below and it sat correctly.
- Pass 1 (4 x 8 plate, 6-long block, grille-brick windows per the meta note, 3-brick tower): the grille bricks made the whole façade a dark mass and nothing read as a window; the model was nearly square (content 162 x 176) in a wide box because the tower was taller than the block was long.
- Pass 2 (6 x 12 plate, 10-long block, trans light blue 1 x 1 bricks as windows alternating with tan, dark 1 x 1 door, tower one brick shorter, two fences): windows, door, roof, clock and fence all read; content 212 x 176. Done.
- Gaps: the doc should warn that the dimetric view makes any footprint contribute to height, so a `wide` micro building has to be long and low (ten studs or more, one or two storeys) to come out wide; it should say cheese slopes break the origin rule; it should say that grille bricks are too dark for micro windows and suggest trans 1 x 1 bricks.

## school-office (wide, minifig vignette)

Started 23:37, finished 23:39. 2 passes.

- Seated figures: the doc says to wrap the figure in an MPD sub-file; I instead added (x, -64, z) to each template line with a small shell function, which worked without learning MPD. Seat `4079` on a 2 x 2 brick, hips `73200b-f2` at the seat top (-32), torso at -64, head -88, hair -112. The thighs run 28 to -Z, so the figure sits at z 30 to clear a desk ending at z 0.
- Pass 1 (computer slope `3039p23` turned to face the figure, smartphone tile `3069bp0t` flat on the other desk): from the camera the turned slope is a plain dark block and the tile is a blue speck; neither read.
- Pass 2 (slope facing the viewer, the phone replaced by minifig radio `3962b` standing on the desk): computer screen and a handset both read; two staff at desks on a plate. Good enough. The figure faces the back of its own monitor, which the viewer will not notice at 96 px.
- Gaps: the doc's phone and computer advice is absent; there is no minifig telephone handset in the library, and the choice for a desk is a radio, a slope with a screen pattern, or a smartphone tile, in that order of legibility. The `3962b` origin is 18 above its base (bounds y -55..18) and the doc's brick rule does not apply.

## lunchbox (square, accessory)

Started 23:38, finished 23:39. 1 pass (two candidates rendered side by side).

- Candidates: `4449-f1` Minifig Suitcase (Closed) turned 30 degrees about Y, against a `4345b` 2 x 2 x 2 box with its `4346` door and a `2540` handle plate stood on edge as a carry handle. The box rendered as a crate with a cage on top; the suitcase reads as a lunchbox at once. Blue, to differ from the teacher's red book.
- Gaps: `4449` should be in the parts list under accessories; the doc's "lay it diagonally" is for bars, a box is fine axis-aligned or turned a little.

## Finish

- 23:38 contact sheet: `spike/blind-test/contact.mjs`, a copy of `spike/contact.mjs` with the cells changed. First run used the `person` sprite as a comparison; at 1:1 pixels it is 1233 px tall and shrank everything else to thumbnails, so swapped it for `building` (221 px). The sheet compares at source pixels, not at the 96 px the map uses, which is the comparison that matters.
- 23:39 wrapped the five PNGs as SVGs in `templates/lego/icons/` and registered them in `template.yml`; wrote `examples/school/` (7 threads, 24 bubbles, 1 burst, 5 actors, 0 links); `check` and `build --png` clean, no warnings. All five `?stem:shape` placeholders resolved.
- Nothing committed. Working-tree changes: `spike/blind-test/`, `examples/school/`, five new files in `templates/lego/icons/`, six lines in `templates/lego/template.yml`, `out/`.

## Afterwards (20 Oct 2026)

Reviewing the 4x renders showed two faults in the inherited minifig numbers, not in the blind-test models: the hand's peg came out through the front of the forearm, and every held item lay 90 degrees across the grip. Both came from the MLCad-style hand offsets in the old template. `spike/hand.mjs` now fits the hand from the parts' own geometry (peg in the arm's cuff socket; held bar along the grip axis), `pose.mjs` and `hold.mjs` use it, and nurse, teacher, parent and school-office were regenerated and re-rendered at 2x and 4x. The icons in the template are the 4x renders.
- 20 Oct: the near office figure's off-centre ponytail (`15427`) hid her face from the camera. Turned it 180 degrees on the stud first, per the new rule: that showed the back of the head instead, so the rule's second step applied and the hair became the short bob (`62711`). Face visible; office re-rendered, re-wrapped, sheets and map rebuilt.

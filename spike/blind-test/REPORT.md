# Blind test report: five school icons from LEGO parts

Fresh session, 19 Oct 2026, 23:24 to 23:40. Method read from `docs/lego-recipes.md` only. Log of every pass in `LOG.md`; models in this directory; renders in `out/spike/blind-test/`; contact sheet at `out/spike/blind-test/contact-sheet.png`; test map `examples/school/` built to `out/school.png`.

## Results

| Stem | Shape | Build scale | Passes | Minutes | Verdict |
|---|---|---|---|---|---|
| `teacher` | tall | minifig | 3 | 5 | Accepted. Glasses, suit and tie, red book carried at the side. Reads as "staff with a book" rather than unmistakably teacher; a pointer or a board would need the same held-item work. |
| `parent` | tall | minifig | 1 | 2 | Accepted. Red zip jacket, jeans, blue school bag hanging from the hand. The strongest of the five at map size. |
| `school` | wide | micro | 2 | 3 | Accepted with a reservation. Clock tower, windows, door, pitched roof and fence read on the contact sheet. At 96 px it reads as "a building with a tower"; the fence vanishes. Fine for a map where the caption says what it is. |
| `school-office` | wide | minifig vignette | 2 | 3 | Accepted. Two seated staff, a screen, a handset on a plate; the same idea as `apha-desk` with far less detail. The figure faces the back of its own monitor, invisible at map size. |
| `lunchbox` | square | accessory | 1 | 1 | Accepted, but it is the minifig suitcase and reads as a briefcase as much as a lunchbox. A sticker or a two-colour lid would fix it; no single part says lunchbox. |

Reading and set-up took four minutes before the first model. No icon needed a fourth pass.

## The three biggest gaps in the doc

1. **Holding anything that is not a tile.** `pose.mjs` assumes the item's length is its X axis and its face is -Y. A book cover, a bag, a pen or an antenna has a different frame, and the doc does not say so or say how to pre-rotate. I wrote `hold.mjs` (book, hanging bag, bar) to get the teacher and parent done; the doc should ship something like it, and say where to find attachment points (`!HELP` lines in part files, like the school bag's handle).
2. **Which way the camera sees the figure.** "Looks from the front-left, so the right arm comes towards the viewer" is true but I misread it: the near (right, -X) side lands on the *right* of the image and the left hand at rest is on the far side. One sentence and a labelled sketch would have saved the first teacher pass. Related: for a `wide` micro building the dimetric view adds the footprint's depth to the height, so it has to be long and low (ten studs, two storeys at most) to come out wide; the first school was square.
3. **The origin rule has exceptions the doc does not flag.** Cheese slopes (`54200`, `85984`) have their origin at the base with the body rising; the minifig radio and the school bag have theirs well inside the body. Bounds in `parts-meta.yml` show it when you look, but the doc states the brick rule as universal, and the two parts I needed most were not in the meta list. A line saying "check bounds before trusting the rule; slopes 31 break it" plus `4449`, `11245`, `24093`, `3245bp07`, `3633` and `3962b` in the list would cover this test.

Smaller gaps: grille bricks are too dark for micro windows (use trans 1 x 1 bricks); the seated-figure recipe suggests MPD sub-files but adding an offset to each line is simpler; there is no minifig telephone handset in the library and no bell part; the `person` sprite swamps a 1:1 contact sheet.

## Verdict on the method

The written method was enough to get five accepted icons in eleven minutes of building (23:28 to 23:39), plus five of reading and set-up without the author, and the render-open-fix loop did its job: every problem was visible on the first render and fixed by the second or third. The cost was the two helper scripts; with the held-item helper and the three notes above in the doc, the next person should manage one or two passes per icon.

## Postscript, 20 Oct 2026

Gap 1 turned out to be deeper than a missing helper: the hand placement the doc inherited was wrong for the current library parts, so hands cut through forearms and items cut through hands in every figure, including the nurse. Fixed in `spike/hand.mjs` from the arm and hand geometry; see the log's last entry. The doc's minifig section and the parts notes for `3818`, `3819` and `3820` now describe the sockets and the grip axis.

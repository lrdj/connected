# Blind test: five school icons from LEGO parts

You are in a fresh session on purpose. The question is whether the written method is enough to make accepted icons quickly, without the person who built it.

## Read first, and only this

`docs/lego-recipes.md`, and the files it points you to when you need them (`spike/parts-meta.yml`, `spike/minifig.ldr`, `spike/pose.mjs`, `spike/render.mjs`, the worked `.ldr` examples in `spike/`). Do not read `spike/SPIKE-NOTES.md` or `spike/next-steps-after-spike.md`; they are history, not method. If the doc is missing something you need, note the gap in the log and work it out from the parts library rather than asking.

## Make these five

Write each model as `spike/blind-test/<stem>.ldr` and render to `out/spike/blind-test/<stem>.png`.

| Stem | Shape | Build scale | Recipe |
|---|---|---|---|
| `teacher` | tall | minifig | A teacher holding a book or pointer. |
| `parent` | tall | minifig | A parent with a bag, dressed for the school run. |
| `school` | wide | micro | A small school building with a clock, a bell tower or a playground fence. |
| `school-office` | wide | minifig vignette | Two staff at desks with a computer and a phone, like the existing `apha-desk` sprite. |
| `lunchbox` | square | accessory | A lunchbox, legible at map size. |

Follow the doc's render, open, fix loop. Stop at good enough. If an icon is not clearly finished after three passes, stop, write down why, and move on; a fourth pass is a result, not a failure.

## Keep a log

`spike/blind-test/LOG.md`. For each icon: the time you started and finished (`date`), one line per pass saying what you saw and what you changed, how many passes, and anything you had to work out that the doc should have told you. Be specific: "the doc did not say where the clip on 92280 is" is useful; "fiddly" is not.

## Finish

1. A contact sheet of the five beside two existing sprites: copy `spike/contact.mjs` to `spike/blind-test/contact.mjs`, change the cells, write `out/spike/blind-test/contact-sheet.png`.
2. A test map. Make `examples/school/` with a `config.yml` using the `lego` template and a short `scenario.txt` with all five as `?stem:shape` actors and six or so threads, following `docs/conversation-maps.md`. Wrap and register the five icons as the recipes doc says, run `build --png`, and look at the map.
3. Report: the table above with passes and minutes filled in, the three biggest gaps in the doc, and your own verdict on each icon. Commit nothing.

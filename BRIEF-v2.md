# Brief v2: Conversation sketches

An alternative to `BRIEF.md`, written by starting from `reference/original.jpg` and asking what it actually is, rather than what tools could draw something like it.

## What the reference is

Look at the image as an author, not as a graph. It is not a flowchart and not a network diagram. It is about ten short **conversations** scattered over a page, each between one or two actors, each two to five turns long. The lines mostly stay inside a conversation: a stub from the actor to what they said, and an L-shaped link from one turn to the next. Only two or three lines cross the page to join one conversation to another. There is no direction of flow, no hierarchy, and no start. The reader wanders.

So the unit of content is the **thread**, not the node. The unit of layout is the **cluster** (a thread drawn as a staircase of boxes with its actors at the ends), not the edge. The page is a loose packing of clusters with a bit of white space, not a routed graph.

Calibration from the reference, at its native 1089 by 814 pixels:

| Thing | Measure |
|---|---|
| Bubbles | 24, one of them a burst |
| Actors | about 17, so nearly one per bubble |
| Threads | about 10, of 2 to 5 turns |
| Cross-thread links | 2 or 3 |
| Words per line | 2 to 4 (12 to 16 characters) |
| Lines per box | 2 to 4, occasionally 7 |
| Box rotation | within about 1.5 degrees |
| Actor height | about one box height |
| Gap between clusters | about one line of text |
| Canvas | landscape, roughly 4:3 |

## What we're building

A small CLI that turns a **screenplay-style text file** into a hand-drawn conversation sketch. The main output is an Excalidraw file for hand finishing. A static SVG is the secondary output. The same text file renders through different **templates** (icon set, voice, stroke style) so the visual grammar can be reused for other ecosystems: connected mobility, tax identity, a CRM rollout, a hospital discharge.

Aim for 80% automatic. The last 20% is dragging clusters about in Excalidraw, and those drags are saved back as hints.

## Stack

- Node + TypeScript, run with `npx tsx src/cli.ts build examples/govid-tax`
- `roughjs` for the SVG output (generator API only, no DOM needed)
- `js-yaml` for config and templates
- Nothing else. No layout engine. The layout is about 200 lines of rules and is the part most worth owning.

Check the live Excalidraw element types before writing the renderer. Only `arrow` elements bind to shapes, and text binds only to rectangles, ellipses, diamonds and arrows, so a burst needs a transparent rectangle underneath to carry its label and its connectors.

## Inputs

### `scenario.txt`

```
@citizen  person
@phone    phone
@hmrc     building   HMRC
@onelogin service    One Login
@branch   building   Post Office

citizen: Where do I start?
phone: Have you got photo ID?
citizen: A passport
phone: Scan your passport

citizen: Can my accountant do this for me?
hmrc: Sure. I'll grant access for this return only.

!onelogin: ALERT! Details don't match   #alert
onelogin: Try in person?
branch: Nearest branch: 0.4 miles

citizen: Who can vouch for me?          #vouch
branch: I can

~ alert vouch
```

- `@id icon [caption]` declares an actor. Caption is optional and most actors have none.
- A blank line separates threads. Each line in a thread is `speaker: words`.
- `!` before the speaker makes the bubble a burst.
- `#name` at the end of a line gives the bubble a handle.
- `~ a b` draws a plain link between two handles across threads. Use sparingly. The reference has two.
- Ids and handles are stable, so hints survive edits to the words.

A parser for this is about 80 lines. It is far quicker to write content this way than as JSON nodes and links, and the content stays readable in a diff.

### `config.yml`

```yaml
template: govuk-services
seed: 42
canvas: { width: 1600, ratio: 4:3 }
density: medium        # tight | medium | loose
wrap: 14               # characters per line
```

### `templates/<name>/template.yml`

An icon set (icon name to SVG path), stroke settings (`roughness`, `strokeWidth`, `bowing`), fonts, spacing presets, and a `voice` note for authors (one line: "short, playful, questions answered in the next turn"). Config overrides template.

## Pipeline

1. **Parse** `scenario.txt`. Fail with the line number and the offending text.
2. **Measure.** Upper-case the words, wrap at `wrap` characters, size the box from a fixed per-character width plus padding. Padding varies from the seed between 0.6 and 1.2 line heights, because the reference boxes are not uniformly padded and that is a large part of the feel.
3. **Compose each thread into a cluster.** Stack its bubbles as a staircase: each turn sits below the last, offset alternately left and right by about half a box width, so the connectors become short L-shapes. Put the first speaker's actor just above or beside the first bubble, and any second actor beside its first turn. Connectors: a short stub from actor to bubble, an L from turn to turn. Give the cluster a bounding box. Different threads get different staircase directions from the seed.
4. **Pack the clusters.** Place them on the canvas in authoring order with a shelf packing, then run a few relaxation passes: push apart any overlapping pair, pull everything gently towards the centre, add a small seeded jitter. Stop when nothing overlaps. This gives the crowded-but-not-touching look without a layout engine.
5. **Route cross-thread links** as one-bend lines. If the bend passes through a bubble, try the other bend. If both do, leave it and print a warning: that is one of the 20% manual fixes.
6. **Apply hints** last: per-cluster offsets, then per-bubble offsets.
7. **Render to Excalidraw.** Rectangles with bound text, arrows with no arrowheads bound at both ends, images for actors with SVGs embedded in `files`, Excalifont, `roughness` from the template, a tiny seeded `angle` on each box. Every element id is a hash of seed plus handle, so rebuilds are diffable and the round-trip can find things again.
8. **Render to SVG** with Rough.js and a vendored OFL handwriting font, same geometry.

## CLI

- `build <dir>` writes `out/<name>.excalidraw` and `out/<name>.svg`
- `check <dir>` parses, measures and reports: thread count, bubble count, any link that could not be routed cleanly
- `pin <dir> <edited.excalidraw>` reads positions back from a hand-edited file and writes them to `hints.yml`
- `watch <dir>` rebuilds on change

## Milestones

Get the look right before the layout, because the look is the whole point and the layout is only there to save dragging.

1. **Renderer with a hand-placed fixture.** Three threads, positions typed by hand. Open the result in Excalidraw beside the reference at the same scale. Tune padding, wrap, angle, stroke and font until it feels right. Nothing else matters until this passes.
2. **Parser and measurement** for the full `govid-tax` scenario.
3. **Cluster composition.** Each thread renders as a convincing staircase on its own.
4. **Packing and cross-thread links.** The whole scenario on one canvas.
5. **SVG output.**
6. **`pin` round-trip.** Edit in Excalidraw, pin, rebuild, confirm identical.
7. **Second template** (`lego-people` or `connected-mobility`) with placeholder icons, proving that the scenario file does not change.

## Acceptance

- Side by side with the reference at the same scale, a stranger would say they were drawn by the same hand.
- Same seed, same bytes.
- Opens and edits cleanly in Excalidraw; connectors stay bound when a box is dragged.
- No connector passes through a bubble, except where `check` has already warned about it.
- Switching template changes icons and stroke, not content.

## Style rules

- Capitals, short lines, loose letter spacing.
- Thin, uneven marker stroke with a hint of overshoot at corners.
- Plain rectangles, the occasional burst, no rounded corners, no fills, no shadows.
- Actors are small and sketchy, drawn by hand later. Placeholders are plain stroked shapes.
- No title on the canvas, no legend, no arrowheads.
- British English in docs and sample content. Do not reuse the reference's words or trace its drawings.

## Why this differs from `BRIEF.md`

- **Threads, not nodes and links.** The content model matches what the picture is, and authoring is a text file rather than a JSON graph with hand-written ids.
- **No ELK.** A layered algorithm with orthogonal routing produces tiers and a direction of flow, which the reference deliberately lacks, and compound nodes make it fiddly. Clusters plus packing is less code, has no dependency, and looks closer.
- **Renderer first.** The original brief builds schema, layout, then renderer. The risk is spending two milestones before seeing whether the thing looks right.
- **Calibration numbers.** Measured from the reference rather than guessed, so "density: medium" means something.
- **Padding and angle jitter** are called out as first-class style parameters. They do more for the hand-drawn feel than roughness does.
- **Fewer dependencies.** Two instead of five.

Kept from the original: Excalidraw as primary output, Rough.js SVG, seeded determinism, templates with placeholder icons, hints round-trip, the `govid-tax` scenario and its voice.

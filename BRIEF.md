# Brief: Hand-drawn service conversation maps

## What we're building

A small CLI tool that generates hand-drawn "conversation map" diagrams for service design work. In these diagrams, actors (people, vehicles, buildings, devices, services) "speak" in speech-bubble boxes joined by right-angled connector lines. The result should look sketched, like a marker drawing on paper, not like a tidy flowchart.

Content lives in JSON. Theme and service parameters live in `config.yml`, which selects from a set of templates. The main output is an **Excalidraw file**, so the layout can be fine-tuned by hand afterwards. A secondary output is a static SVG.

Aim for a tool that gets a diagram about 80% of the way there and leaves the last 20% as quick manual edits. Don't try for a perfect automatic layout.

## Stack

- Node + TypeScript, run as a CLI: `npx tsx src/cli.ts build examples/govid-tax`
- [elkjs](https://github.com/kieler/elkjs) for layout, using the `layered` or `force` algorithm with `elk.edgeRouting: ORTHOGONAL`
- [roughjs](https://roughjs.com) for the SVG renderer
- `js-yaml` and `zod` for loading and validating input
- Keep dependencies minimal. No frontend framework.

Before generating elements, **check the current Excalidraw file schema** in the excalidraw repo (`packages/excalidraw/element/types.ts` and the `.excalidraw` JSON format). Pay particular attention to text, image + `files`, arrow bindings and elbow arrows. Don't rely on remembered field names.

## Repo layout

```
src/
  cli.ts              # build / validate / watch commands
  schema.ts           # zod schemas for diagram.json + config.yml + template.yml
  load.ts             # load + merge template defaults with config + diagram
  measure.ts          # text wrapping + box sizing
  layout.ts           # ELK graph build + run, apply manual x/y hints
  render/excalidraw.ts
  render/svg.ts
templates/
  govuk-services/     # template.yml + icons/*.svg
  lego-people/
  crm-rollout/
examples/
  govid-tax/          # diagram.json + config.yml
out/                  # generated files (gitignored)
```

## Inputs

### `diagram.json`

```json
{
  "nodes": [
    { "id": "citizen", "kind": "actor", "icon": "person", "label": "" },
    { "id": "q1", "kind": "bubble", "label": "Do I need to prove who I am?", "speaker": "citizen" },
    { "id": "hmrc", "kind": "actor", "icon": "building", "label": "" },
    { "id": "a1", "kind": "bubble", "label": "Yes - sign in with GOV.UK One Login", "speaker": "hmrc" },
    { "id": "alert", "kind": "bubble", "style": "burst", "label": "ALERT!" }
  ],
  "links": [
    { "from": "q1", "to": "a1" },
    { "from": "citizen", "to": "q1", "type": "speaker" }
  ],
  "hints": { "q1": { "x": 120, "y": 80 } }
}
```

- `kind`: `bubble` (a boxed label) or `actor` (an icon, with an optional caption)
- `style` for bubbles: `box` (the default) or `burst` (the spiky exclamation shape)
- `speaker` links a bubble to its actor. The bubble should be placed close to that actor, joined by a short tail line.
- `hints` pin positions after layout. They let a hand-tuned layout survive regeneration.

### `config.yml`

```yaml
template: govuk-services
title: GovID checking for tax
seed: 42            # deterministic wobble
density: medium     # spacing preset: tight | medium | loose
labels:
  case: upper       # labels rendered in capitals, like hand lettering
  maxWidth: 22      # characters per line before wrapping
```

### `templates/<name>/template.yml`

Each template defines its icon set (a map from icon name to SVG file), its stroke settings (`roughness`, `strokeWidth`, `bowing`), its font, and its spacing presets. The config overrides any template default.

## Pipeline

1. **Load and validate** all three files and merge them as template → config → diagram. Fail with clear messages that point to the offending node or link id.
2. **Measure.** Wrap each label to `maxWidth` and compute box dimensions with a fixed character-width approximation for the chosen font, plus padding. Use real glyph metrics later if needed.
3. **Layout.** Build an ELK graph and run orthogonal routing. Treat each actor and its bubbles as a cluster, either with ELK compound nodes or with a post-pass that pulls them together. Apply `hints` last.
4. **Render to Excalidraw:**
   - Bubbles become `rectangle` elements plus bound `text` elements. Bursts become a `line` polygon with a jagged outline.
   - Links become arrow or line elements with **no arrowheads**, elbowed or orthogonal. Bind them to nodes so they stay connected when boxes are dragged.
   - Actors become `image` elements, with their SVGs embedded as data URLs in `files`.
   - Use the Excalidraw hand-drawn font, and set `roughness` from the template.
   - Derive all ids and seeds from `config.seed`, so builds are reproducible and diffable.
5. **Render to SVG.** Draw the same geometry with Rough.js and a handwriting web font. The custom font goes here, because Excalidraw custom fonts are limited.

## CLI

- `build <dir>` writes `out/<name>.excalidraw` and `out/<name>.svg`
- `validate <dir>` checks the inputs only
- `watch <dir>` rebuilds whenever the inputs change

## Milestones

1. Schema, loader and validation, using the `govid-tax` example (about 15 bubbles and 4 actors)
2. Measurement and ELK layout, with a debug SVG of plain boxes and lines
3. Excalidraw renderer. Open the file at excalidraw.com and check that it's editable and the connectors stay bound.
4. Rough.js SVG renderer
5. Templates: at least `govuk-services` and `lego-people`, with placeholder icons
6. Manual `hints` round-trip: a command that reads an edited `.excalidraw` file and writes positions back into `hints`

## Acceptance

- The `govid-tax` example builds with no errors, and the result opens and edits cleanly in Excalidraw.
- No connector crosses through a bubble. Line crossings are acceptable but kept to a minimum.
- The same seed always produces identical output.
- Switching `template:` in `config.yml` changes the icons and stroke style without touching `diagram.json`.

## Style reference

`reference/original.jpg` is the hand-drawn diagram that inspired this tool. It is a guide to the overall feel, not something to reproduce. Use it to calibrate:

- **Stroke:** thin, uneven marker lines with slight overshoot at corners
- **Lettering:** all capitals, loose spacing, short lines
- **Connectors:** right-angled, unadorned, sometimes hopping over each other with a small arc
- **Density:** fairly crowded, with plenty of white space inside the boxes but little between clusters
- **Bubbles:** plain rectangles, with the occasional spiky "burst" for alerts

Don't sample, trace or vectorise anything from the reference image, and don't copy its text into templates or examples.

## Constraints

- **Icons are placeholders.** Use simple stroked SVGs that I'll replace with my own drawings. Don't copy or trace existing illustrators' work.
- Keep it simple, because this is a personal tool. Write a README with a worked example.
- Use British English in docs and sample content.

## Sample content for `govid-tax`

The scenario is a citizen proving their identity to file a tax return. Actors: citizen, phone, HMRC, One Login, and a Post Office branch. Bubbles should mix questions, answers and system prompts in the conversational, slightly playful voice of the original style, for example:

- "Where do I start?" / "Have you got photo ID?" / "Scan your passport"
- "Can my accountant do this for me?" / "Sure - I'll grant access for this return only"
- "ALERT! Details don't match" / "Try in person?" / "Nearest branch: 0.4 miles"

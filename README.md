# Connected

Hand-drawn conversation sketches, generated from a screenplay-style text file. Actors (people, phones, buildings, services) speak in boxes joined by right-angled lines, in the manner of a marker drawing on paper.

The main output is an Excalidraw file for hand finishing. A Rough.js SVG is the secondary output. See `BRIEF-v2.md` for the design.

Turning an existing diagram, a brief or a list of conversations into one of these, by hand or with an AI agent? Start with `docs/conversation-maps.md`. The file format is in `docs/scenario-format.md`.

## Status

All seven milestones in `BRIEF-v2.md` are done: parser, measurement, cluster composition, packing, cross-thread links, an SVG with Excalifont embedded, the `pin` round-trip, and two templates.

## Run

```
npm install
node --import tsx src/cli.ts build examples/govid-tax          # out/govid-tax.excalidraw and .svg
node --import tsx src/cli.ts build examples/connected-car --png   # also a PNG preview via sharp
node --import tsx src/cli.ts check examples/govid-tax          # parse, counts and warnings, no files
node --import tsx src/cli.ts pin examples/govid-tax            # record hand edits from out/govid-tax.excalidraw
node --import tsx src/cli.ts pin examples/govid-tax ~/Downloads/edited.excalidraw
node --import tsx src/cli.ts fixture                            # the hand-placed sketch used to tune the look
node --import tsx src/cli.ts preview out/some.svg               # rasterise any SVG
npm run typecheck
```

Open the `.excalidraw` file at excalidraw.com with Open, or drag it onto the canvas. Boxes carry their text, connectors stay bound when things are dragged, and captioned actors and bursts are grouped so they move as one.

## Worked example

`examples/govid-tax/` holds a scenario and a config:

```
@citizen  person
@phone    phone

citizen: Where do I start?
phone: Have you got photo ID?
```

Each `@` line declares an actor with an icon from the template and an optional caption. An icon that is not drawn yet can be a placeholder, `?vet:tall` or `?border-control-post:wide`, drawn as a labelled dashed box; `build` lists the placeholders left to draw and writes them to `out/placeholders/`. A blank line separates threads. `!` before a speaker makes a burst. `#handle` at the end of a line names a bubble, and `~ a b` links two named bubbles across threads. Lines starting with `#` are comments.

An actor is drawn once per thread it speaks in, next to its first turn there, which is how the reference drawing works too. Three markers refine that:

```
@carpark  building-carpark  once        # one icon for the whole sketch; every thread attaches to it

car: What's ahead?            #ahead
car: Where can I park?        < ahead   # answers "ahead", not the line above: the thread forks
car: I'm bored                < ahead
car: Meet at the shop         < a b     # answers two bubbles: the thread merges

car@carpark: Here I am!                 # the car's words, hanging off the car park's icon
```

`once` suits a place or system that several conversations pass through, like the car park in the reference. Keep it to hubs with two or three spokes: every extra spoke is a long line the packer has to thread past other boxes, and `build` warns when one crosses. A `<` reply to a bubble in another thread is the same as a `~` link.

`config.yml` picks the template, seed, canvas and density. Anything in the template can be overridden there. The canvas width is the packing width; the height is a target, and `build` warns when the content runs more than 15% over it.

## Finishing by hand

Build, open the `.excalidraw` file, drag things about, then save it (Excalidraw's menu, Save to disk) and run `pin`. It compares the saved file with what `build` produces, element by element, and writes the differences to `hints.yml` next to the scenario:

- a bubble or actor that moved or was resized gets its new position
- an actor instance or a link that was deleted goes in `remove`
- a link whose line you reshaped, or whose end you dragged to a different spot on its box, is kept exactly as drawn, including where it attaches

The next `build` applies the hints, re-routes any link touching something that moved, and leaves pinned links alone. Hints are keyed by handle, so they survive edits to the words. Unnamed bubbles are numbered by position in their thread, so if you insert or reorder lines, name the bubbles you've pinned with `#handle` first. Running `pin` again after a rebuild records nothing new, and deleting `hints.yml` starts again from the automatic layout.

Deleting a bubble in Excalidraw is reported but not recorded: take the line out of `scenario.txt` instead.

## How layout works

There is no graph layout engine. Each thread is composed into a cluster: its bubbles stacked as a staircase, with each speaker's icon beside their first turn. Clusters are then packed bottom-left onto the canvas by their actual boxes, so staircases interlock. A thread linked to an earlier one with `~` is packed as near to it as it will fit. Cross-thread links are routed as one bend, and `build` warns when a link has to pass through a box so you know what to fix by hand.

## Templates

`templates/<name>/template.yml` names the icons, stroke, font and spacing. Icons are sized from their SVG viewBox: either fitted to `actorSize` or, if the template sets `iconScale`, multiplied by that so a hand-drawn set keeps its relative sizes. The `connected-car` template holds the user's own vectorised drawings; `govuk-services` has plain placeholder icons.

`sharp` is a dev dependency used only for PNG previews. The `.excalidraw` and `.svg` outputs never need it. The SVG embeds Excalifont (SIL Open Font License, vendored in `fonts/Excalifont/`), so it renders the same anywhere with no internet.

## Layout

```
src/            pipeline: parse, load, measure, geometry, layout, hints, render/excalidraw, render/svg
docs/           guide for turning other diagrams into conversation maps, and the file format reference
fixtures/       hand-placed sketch used to tune the look
templates/      icon sets and stroke settings: govuk-services (placeholders), connected-car (the reference's drawings)
examples/       scenario.txt + config.yml (+ hints.yml) per map: govid-tax, connected-car, clinic-appointment, meat-export (placeholder icons)
fonts/          Excalifont, SIL OFL, embedded in the SVG output
out/            generated files, not committed
```

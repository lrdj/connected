# Agent notes

This repository is a CLI that turns a screenplay-style `scenario.txt` into a hand-drawn **conversation map**: actors speaking in boxes joined by plain lines, as an Excalidraw file and a self-contained SVG.

If you have been asked to turn a systems diagram, process flow, ecosystem map, service blueprint, written brief or list of conversations into one of these, read `docs/conversation-maps.md` first and follow its procedure, including section 7 on placeholder icons. The file format is specified in `docs/scenario-format.md`. `examples/clinic-appointment/` is a worked example made from a service blueprint; `examples/meat-export/` shows placeholder icons.

Commands:

```
npm install
node --import tsx src/cli.ts check examples/<name>
node --import tsx src/cli.ts build examples/<name> --png
node --import tsx src/cli.ts pin examples/<name>
npm run typecheck
```

Rules of thumb: six to fourteen threads of two to five turns; words short and conversational; at most three cross-thread links; `once` only for a hub with two or three spokes. Warnings about a link passing through a box are for hand finishing, not for you to fix in code. When no icon fits an actor, declare it with a placeholder (`?name`, `?name:tall`, `?name:wide`) rather than the nearest wrong icon; the user draws the icons later.

Design notes are in `BRIEF-v2.md`. There is no graph layout engine on purpose. Use British English in docs and sample content. Do not add arrowheads, titles, legends or colours to the output.

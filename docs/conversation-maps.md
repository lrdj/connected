# Making conversation maps from other diagrams

A guide for people and for AI agents (Claude, Codex, or any other) that have a systems diagram, a process flow, an ecosystem map or a service blueprint and need to turn it into a **conversation map** using this tool.

Read this whole file before writing a scenario. The format reference is in `scenario-format.md`. The commands are at the end.

## 1. What a conversation map is

A conversation map shows an ecosystem as a set of short conversations. Actors (people, devices, buildings, services, vehicles) speak in boxes joined by plain lines. There are no arrowheads, no swimlanes, no legend and no title on the canvas. The reader wanders across it and picks up how the system works from what the parts say to each other.

It is drawn to look hand-sketched, with capital letters, uneven boxes and wobbly lines. The point is to feel like a napkin drawing that explains a system, not a diagram that specifies it.

The unit of content is the **thread**: one conversation of two to five turns between one to three actors. A map is ten or so threads scattered over a page, each one readable on its own. A few threads link to each other. That is all.

What a conversation map is good for:

- showing a whole ecosystem on one page in a way non-specialists read willingly
- revealing the voice of each part: what it asks, what it answers, where it is unhelpful
- workshops, discovery reports, the first page of a service design pack

What it is not: a flowchart, a sequence diagram, an architecture diagram or a blueprint. It deliberately loses ordering, completeness and precision. If you need those, keep the original diagram alongside it.

## 2. The tool in one paragraph

You write a `scenario.txt` in a screenplay style, pick a template and a seed in `config.yml`, and run `build`. The tool measures the text, composes each thread into a cluster, packs the clusters onto a canvas and writes an Excalidraw file for hand finishing plus a self-contained SVG. It aims to get a map 80% of the way; the last 20% is a person dragging things in Excalidraw, and `pin` saves those drags so a rebuild keeps them.

## 3. The translation, source by source

The job is the same whatever you start from: find the actors, find the exchanges, write each exchange as a short conversation in the actors' own voices. Below is how each source diagram maps onto that.

### 3.1 Systems and architecture diagrams

Boxes are components; arrows are calls or data flows, usually labelled with a noun.

- **Components become actors**, but only those with a voice. A payment service, a mobile app, a customer, a branch and a partner API all speak. A load balancer, a queue or a database usually does not, so leave it out unless it says something a reader needs ("I'm the system of record for addresses").
- **Choose an icon kind** for each: `person` for humans, `phone` for apps and devices, `building` for places and organisations, `service` for systems and APIs. Templates may have more.
- **Each labelled arrow becomes a turn**, spoken by the arrow's source, in words rather than nouns. `GET /eligibility` becomes `Am I eligible?`. `Eligibility response` becomes `Yes, as of today`.
- **Group arrows into threads by exchange.** A request and its response are one thread. A chain of three calls that serve one user action are one thread. Do not make one thread per component.
- **Hubs.** A component with arrows to everything is a hub. Declare it `once` only if three or fewer threads pass through it; otherwise let it be drawn in each thread, which the reader accepts without noticing.

### 3.2 Process flows and flowcharts

Steps are boxes, decisions are diamonds, swimlanes name who does what.

- **Swimlanes become actors.** If there are no swimlanes, infer who performs each step.
- **Each step becomes a turn** spoken by its actor, as what they say or ask at that step. `Verify identity documents` becomes `phone: Scan your passport`. A system step becomes what the system tells the user, or a burst if it is an alert.
- **A decision becomes a question with two replies.** The diamond's question is a turn. Each outgoing branch is a reply to it with `< handle`, and the branch condition becomes the reply's words:

  ```
  phone: Have you got photo ID?      #id
  citizen: A passport                < id
  phone: Scan your passport
  citizen: Only a driving licence    < id
  phone: That works too
  ```

- **Loops are not drawn.** Write the retry as a second turn ("Try again?") and move on.
- **Split a long flow into threads** at hand-offs between actors or at milestones. Six to fourteen threads is the normal range. Threads keep their internal order; the page does not keep the order between threads, and that is intended.
- **Continuity across threads** goes through `~` links or `< handle` replies to another thread. Use at most three per map. More than that turns the map back into a flowchart.

### 3.3 Ecosystem maps and stakeholder maps

Actors around a centre, with lines labelled by relationship.

- **Every node becomes an actor**, but many relationships deserve no thread. Pick the ten or so relationships that carry the story.
- **Each chosen relationship becomes a two-turn thread**: what one party asks for or offers, and what the other says back. `Provides data to` is not a conversation; `Can I have last month's readings?` and `Here, sent nightly` is.
- **The central actor** is tempting to mark `once`. Only do it with three or fewer threads touching it; otherwise it becomes a hub with long lines crossing everything. Drawing it in several threads is fine and is what the original hand-drawn reference does.

### 3.4 Service blueprints

Rows: customer actions, frontstage, backstage, support processes. Columns: stages of the journey. A line of visibility between frontstage and backstage.

- **The customer becomes a `person`.** Each frontstage touchpoint becomes an actor of its kind: a `phone` for the app, a `building` for a branch, a `person` for a member of staff. Backstage systems become `service` actors.
- **Each column becomes a thread**, read top to bottom: the customer says or asks, the touchpoint answers, backstage speaks only if the customer would notice ("Checking your details, give me a moment").
- **The line of visibility is `speaker@node`.** A backstage system that speaks through a touchpoint writes `records@phone: Your address is out of date`. The voice is the system's, the bubble hangs off the phone, and the file still records which was which.
- **Pain points and failures become bursts**: `!records: ALERT! Details don't match`.
- **Physical evidence** rarely needs drawing. If a letter matters, let someone talk about it: `branch: Bring the letter and your passport`.
- **Time and metrics** have no place on the map. Put them in the words if they matter: `branch: Nearest branch: 0.4 miles`.

## 4. Writing the words

The map works or fails on the words, so spend most of the effort here.

- **Short.** Two to five words a line, two to four lines a box. Wrap is 14 characters by default; a turn of more than about 60 characters makes a box that dominates the page. The reference drawing has exactly one long box, and that is a joke about a drunk driver.
- **Conversational and first person.** `Where do I start?`, `Sure, I'll grant access for this return only`, `Nearest branch: 0.4 miles`.
- **Questions get answered in the next turn.** The reader expects it.
- **Systems speak like helpful people.** Not `Authentication successful` but `You're in`.
- **Mix the register**: questions, answers, system prompts, the odd complaint, one alert. A map where every turn is a system message reads as a log.
- **Capitals are added by the tool.** Write normal sentence case.
- **British English** in sample content unless the source material is in another register and fidelity matters, as in a verbatim recreation.

## 5. Proportions that look right

These come from measuring the reference drawing. Aim for them; `check` prints the counts.

| Thing | Aim for |
|---|---|
| Threads | 6 to 14 |
| Turns per thread | 2 to 5 |
| Bubbles in total | 15 to 35 |
| Declared actors | 5 to 12 |
| Bursts | 0 to 2 |
| Cross-thread links (`~` or `<` across threads) | 0 to 3 |
| `once` actors | 0 to 2, each with 2 or 3 spokes |
| Characters per turn | mostly under 40, never over 90 |

A map with more content than this should become two maps.

## 6. Procedure for an agent

1. Read the source diagram and list its actors. Decide an icon kind for each and which template to use (`govuk-services` has `person`, `phone`, `building`, `service`; others are listed in `templates/`). If an icon kind is missing, use the nearest and say so in a comment at the top of the file.
2. List the exchanges that carry the story. Drop the rest. Write each exchange as a thread in the actors' voices.
3. Write `scenario.txt` and `config.yml` in a new directory under `examples/`, or wherever the host repo keeps them. A comment line at the top should name the source document.
4. Run `check`. Fix any parse error it reports; it quotes the line. Compare the counts with the table above.
5. Run `build --png` and look at the PNG. Then read the warnings. A warning that a link passes through a box is not an error; it tells a person what to fix by hand. If there are more than three such warnings, the map is too connected: remove links or split hubs.
6. Say in your reply which exchanges from the source you left out and why, and which warnings remain for hand finishing.

Do not try to reproduce the source diagram's layout or completeness. Do not add arrowheads, titles, legends or colours. Do not invent a layout engine; the tool has one.

## 7. Worked example

`examples/clinic-appointment/` was made from a four-column service blueprint for booking a clinic appointment (columns: find a slot, confirm identity, attend, follow up; rows: patient, app, receptionist, booking system, records). Read its `scenario.txt` to see every rule above applied, including a fork at the identity question, a `speaker@node` turn where the records system speaks through the app, and one burst.

## 8. Commands

```
npm install
node --import tsx src/cli.ts check examples/<name>          # parse, counts, warnings
node --import tsx src/cli.ts build examples/<name> --png    # out/<name>.excalidraw, .svg, .png
node --import tsx src/cli.ts pin examples/<name>            # after hand edits, record them in hints.yml
```

Outputs go in `out/`. The `.excalidraw` file opens at excalidraw.com or in the VS Code Excalidraw extension. The `.svg` embeds its font and needs nothing else.

## 9. Templates

A template is a directory under `templates/` with `template.yml` and an `icons/` folder of SVGs. To add one for a new domain, copy `govuk-services`, replace the SVGs, and list them under `icons:` in the YAML. Keep icons as plain stroked drawings. If the icons are drawn at a consistent scale, set `iconScale` so their relative sizes survive; otherwise they are fitted to `actorSize`. Config can override any template value.

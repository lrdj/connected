# scenario.txt reference

The exact grammar of a scenario file, for anyone writing one by hand or by machine. The guide to choosing what goes in it is `conversation-maps.md`.

## File shape

```
# comment lines start with a hash

@citizen  person
@phone    phone
@hmrc     building   HMRC
@branch   building   once  Post Office

citizen: Where do I start?
phone: Have you got photo ID?        #id
citizen: A passport                  < id
phone: Scan your passport
citizen: Only a driving licence      < id

!hmrc: ALERT! Details don't match    #alert
hmrc: Try in person?
branch: Nearest branch: 0.4 miles

citizen@branch: Here I am

~ alert id
```

Lines are processed top to bottom. Blank lines separate threads. Whitespace within a line is free.

## Actor declarations

```
@<id> <icon> [once] [caption words]
```

- `id`: letters, digits, `_`, `-`. Must be unique. Used as the speaker name in turns.
- `icon`: a name from the template's `icons:` list. Unknown icons fail at `check`.
- `once`: optional. The actor is drawn a single time for the whole map, and every thread it speaks in attaches to that one icon.
- caption: optional, the rest of the line. Drawn under the icon in small capitals. Use for buildings and services, not for people.

Declarations go before the first thread or between threads, never inside one.

## Turns

```
[!]<speaker>[@<node>]: <words> [#<handle>] [< <handle> [<handle>...]]
```

- `!` makes a burst, the spiky shape for alerts.
- `speaker`: a declared actor id. Whose voice it is.
- `@node`: optional, a declared actor id. Whose icon the bubble hangs off. Omit it and the bubble hangs off the speaker's own icon.
- `words`: the text. The tool wraps and capitalises it. Keep it under about 60 characters.
- `#handle`: optional name for this bubble. Letters, digits, `_`, `-`. Must be unique in the file. Needed for replies, links and hints.
- `< a b`: optional. The bubble answers bubble `a` (and `b`) instead of the line above it.

The trailing `#handle` and `< ...` markers may appear in either order.

### Default parent

A turn with no `<` marker answers the previous turn in its thread, and the first turn of a thread answers nothing. The thread is laid out as a staircase from the first turn down.

### Replies within a thread

A `<` reply to a bubble in the same thread moves this turn under that bubble:

- one target: the thread forks. The first reply to a bubble steps down one side, the next steps down the other.
- two or more targets: the thread merges. The turn sits below all of them with a line from each.

Targets must be earlier lines. A bubble cannot answer itself.

### Replies across threads

A `<` reply to a bubble in an earlier thread does not move anything. It draws a line between the two, and the packer places the two threads near each other. It is the same as a `~` line.

## Links

```
~ <handle> <handle>
```

A plain line between two named bubbles, anywhere in the file, and the two threads are packed near each other. Both handles must exist by the end of the file.

## Automatic handles

Every bubble has a handle. Unnamed ones are `t<thread>.<turn>`, counting from 1: the third bubble of the second thread is `t2.3`. These are stable only while nothing is inserted or reordered before them. Name any bubble you refer to or pin.

Actor instances are `actor.t<thread>.<id>`, or `actor.<id>` for a `once` actor. Links are `link.<parent>.<child>`, `stub.<actor handle>.<bubble>` and `cross.<a>.<b>`. These appear in warnings and in `hints.yml`.

## Errors

`check` and `build` stop on the first problem and print the line number and the line. The messages say what to do:

- unknown speaker or node: declare it
- unknown icon: use one from the template
- reply to an unknown handle: name an earlier bubble with `#`
- handle used twice
- actor declared inside a thread: move it above
- a turn with no words

## config.yml

```yaml
template: govuk-services       # directory under templates/
seed: 42                       # any integer; same seed, same output
canvas: { width: 1600, ratio: "4:3" }   # packing width; height is a target, build warns past it
density: medium                # tight | medium | loose, from the template
wrap: 14                       # characters per line
```

Any value from the template (`stroke`, `font`, `padding`, `angle`) can be overridden here under the same key.

## hints.yml

Written by `pin`, read by `build`. Keyed by handle. You can edit it or delete it.

```yaml
bubbles:
  id: { x: 154, y: 336 }           # also w and h if resized
actors:
  actor.t2.hmrc: { x: 640, y: 210 }
links:
  link.alert.t3.2:
    points: [[975, 244], [1012, 292], [1171, 292]]
    start: [0.5, 1]                # Excalidraw fixedPoint ratios on the start box
    end: [0.25, 0]
remove:
  - actor.t2.hmrc
```

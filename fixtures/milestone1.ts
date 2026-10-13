/**
 * Milestone 1 fixture: three threads from the govid-tax scenario with
 * positions typed by hand. Exists to tune the look before any layout code.
 */
import { actorFootprint, routeL } from "../src/geometry.js";
import { iconBox } from "../src/load.js";
import { measureBubble } from "../src/measure.js";
import { rngFor } from "../src/rng.js";
import type { RenderContext, Sketch, SketchActor, SketchBubble, SketchLink } from "../src/types.js";

interface HandBubble { handle: string; speaker: string; text: string; x: number; y: number; burst?: boolean }
interface HandActor { thread: string; id: string; icon: string; x: number; y: number; caption?: string }

const bubbles: HandBubble[] = [
  // Thread 1: citizen and phone
  { handle: "t1.1", speaker: "citizen", text: "Where do I start?", x: 190, y: 90 },
  { handle: "t1.2", speaker: "phone", text: "Have you got photo ID?", x: 360, y: 200 },
  { handle: "t1.3", speaker: "citizen", text: "A passport", x: 230, y: 330 },
  { handle: "t1.4", speaker: "phone", text: "Scan your passport", x: 400, y: 420 },
  // Thread 2: citizen and HMRC
  { handle: "t2.1", speaker: "citizen", text: "Can my accountant do this for me?", x: 760, y: 120 },
  { handle: "t2.2", speaker: "hmrc", text: "Sure. I'll grant access for this return only.", x: 950, y: 250 },
  // Thread 3: One Login and the branch
  { handle: "t3.1", speaker: "onelogin", text: "ALERT! Details don't match", x: 700, y: 480, burst: true },
  { handle: "t3.2", speaker: "onelogin", text: "Try in person?", x: 560, y: 640 },
  { handle: "t3.3", speaker: "branch", text: "Nearest branch: 0.4 miles", x: 760, y: 730 },
];

const actors: HandActor[] = [
  { thread: "t1", id: "citizen", icon: "person", x: 100, y: 120 },
  { thread: "t1", id: "phone", icon: "phone", x: 590, y: 130 },
  { thread: "t2", id: "citizen", icon: "person", x: 670, y: 160 },
  { thread: "t2", id: "hmrc", icon: "building", x: 1160, y: 120, caption: "HMRC" },
  { thread: "t3", id: "onelogin", icon: "service", x: 780, y: 330, caption: "One Login" },
  { thread: "t3", id: "branch", icon: "building", x: 1000, y: 610, caption: "Post Office" },
];

export function buildFixture(ctx: RenderContext): Sketch {
  const { style } = ctx;

  const placedBubbles: SketchBubble[] = bubbles.map((b) => {
    const rng = rngFor(ctx.seed, b.handle);
    const measured = measureBubble(b.text, style, rng, b.burst ?? false);
    const angle = (rng() * 2 - 1) * style.angle;
    return {
      handle: b.handle,
      speaker: b.speaker,
      text: b.text,
      burst: b.burst ?? false,
      measured,
      box: { x: b.x, y: b.y, w: measured.w, h: measured.h },
      angle,
    };
  });

  const placedActors: SketchActor[] = actors.map((a) => {
    const icon = ctx.icons[a.icon];
    if (!icon) throw new Error(`Fixture actor ${a.id} uses unknown icon "${a.icon}"`);
    return {
      handle: `actor.${a.thread}.${a.id}`,
      actorId: a.id,
      icon: a.icon,
      caption: a.caption,
      box: { x: a.x, y: a.y, ...iconBox(icon, style) },
    };
  });

  const byHandle = new Map(placedBubbles.map((b) => [b.handle, b]));
  const links: SketchLink[] = [];

  // Consecutive turns within a thread.
  for (let i = 1; i < placedBubbles.length; i++) {
    const prev = placedBubbles[i - 1]!;
    const next = placedBubbles[i]!;
    if (prev.handle.split(".")[0] !== next.handle.split(".")[0]) continue;
    links.push({ handle: `link.${prev.handle}.${next.handle}`, from: prev.handle, to: next.handle, kind: "turn", points: routeL(prev.box, next.box) });
  }

  // Each actor instance to the first bubble its actor speaks in that thread.
  for (const a of placedActors) {
    const [, thread, id] = a.handle.split(".");
    const first = placedBubbles.find((b) => b.handle.startsWith(`${thread}.`) && b.speaker === id);
    if (!first) continue;
    links.push({ handle: `stub.${a.handle}`, from: a.handle, to: first.handle, kind: "stub", points: routeL(actorFootprint(a.box, a.caption, style), first.box) });
  }

  void byHandle;
  return { bubbles: placedBubbles, actors: placedActors, links, canvas: { x: 0, y: 0, ...style.canvas } };
}

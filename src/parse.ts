/**
 * Parser for scenario.txt.
 *
 *   @id icon [once] [caption]   declare an actor; `once` draws it a single time for all threads
 *   speaker: words              a turn; a blank line ends the thread
 *   speaker@node: words         the speaker's words, attached to another actor's icon
 *   !speaker: words             a burst
 *   ... #handle                 name the bubble (for replies, links and hints)
 *   ... < a b                   answer earlier bubbles a and b instead of the previous turn
 *   ~ a b                       link two named bubbles across threads
 *   # comment                   a full-line comment
 */
import type { ActorDecl, Scenario, Thread, Turn } from "./types.js";

export class ParseError extends Error {
  constructor(public readonly line: number, message: string, public readonly text?: string) {
    super(`line ${line}: ${message}${text !== undefined ? `\n  > ${text}` : ""}`);
  }
}

const ACTOR = /^@([A-Za-z0-9_-]+)\s+([A-Za-z0-9_-]+)(?:\s+(once)\b)?(?:\s+(.+?))?\s*$/;
const TURN = /^(!?)([A-Za-z0-9_-]+)(?:@([A-Za-z0-9_-]+))?:\s*(.*?)\s*$/;
const HANDLE = /\s+#([A-Za-z0-9_-]+)\s*$/;
const REPLY = /\s+<((?:\s+[A-Za-z0-9_.-]+)+)\s*$/;
const LINK = /^~\s+([A-Za-z0-9_.-]+)\s+([A-Za-z0-9_.-]+)\s*$/;

export function parseScenario(source: string): Scenario {
  const actors: ActorDecl[] = [];
  const actorIds = new Set<string>();
  const threads: Thread[] = [];
  const links: Array<[string, string]> = [];
  const handles = new Map<string, number>();
  let current: Turn[] = [];
  let currentHandles = new Set<string>();
  const pendingLinks: Array<{ line: number; a: string; b: string }> = [];

  const endThread = (): void => {
    if (current.length) threads.push({ turns: current });
    current = [];
    currentHandles = new Set();
  };

  const lines = source.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trimEnd();
    if (text.trim() === "") return endThread();
    if (text.trimStart().startsWith("#")) return;

    const actor = text.match(ACTOR);
    if (actor) {
      const [, id, icon, once, caption] = actor;
      if (current.length) throw new ParseError(line, "actor declarations must come before or between threads, not inside one", text);
      if (actorIds.has(id!)) throw new ParseError(line, `actor "${id}" declared twice`, text);
      actorIds.add(id!);
      actors.push({ id: id!, icon: icon!, ...(caption ? { caption } : {}), ...(once ? { once: true } : {}) });
      return;
    }

    const link = text.match(LINK);
    if (link) {
      pendingLinks.push({ line, a: link[1]!, b: link[2]! });
      return;
    }

    const turn = text.match(TURN);
    if (!turn) throw new ParseError(line, 'expected "speaker: words", "@id icon", "~ a b" or a blank line', text);
    const [, bang, speaker, nodeName, rest] = turn;
    if (!actorIds.has(speaker!)) throw new ParseError(line, `unknown speaker "${speaker}" (declare it with @${speaker} <icon>)`, text);
    const node = nodeName ?? speaker!;
    if (!actorIds.has(node)) throw new ParseError(line, `unknown node "${node}" after @ (declare it with @${node} <icon>)`, text);

    // Trailing markers, in any order: #handle and < reply targets.
    let words = rest!;
    let handle: string | undefined;
    const replies: string[] = [];
    for (;;) {
      const named = words.match(HANDLE);
      if (named) {
        if (handle) throw new ParseError(line, "only one #handle per turn", text);
        handle = named[1]!;
        words = words.slice(0, named.index).trimEnd();
        continue;
      }
      const reply = words.match(REPLY);
      if (reply) {
        replies.unshift(...reply[1]!.trim().split(/\s+/));
        words = words.slice(0, reply.index).trimEnd();
        continue;
      }
      break;
    }
    if (!words) throw new ParseError(line, "a turn needs some words", text);

    const auto = `t${threads.length + 1}.${current.length + 1}`;
    const final = handle ?? auto;
    if (handles.has(final)) throw new ParseError(line, `handle "${final}" already used on line ${handles.get(final)}`, text);
    handles.set(final, line);
    if (handle) handles.set(auto, line);

    // Replies to this thread shape the staircase; replies to another thread become links.
    const replyTo: string[] = [];
    for (const target of replies) {
      if (!handles.has(target)) throw new ParseError(line, `reply to unknown handle "${target}" (it must be an earlier bubble named with #${target})`, text);
      if (target === final) throw new ParseError(line, "a bubble cannot reply to itself", text);
      if (currentHandles.has(target)) replyTo.push(target);
      else links.push([target, final]);
    }

    currentHandles.add(final);
    if (handle) currentHandles.add(auto);
    current.push({ speaker: speaker!, node, text: words, burst: bang === "!", handle: final, replyTo });
  });
  endThread();

  for (const { line, a, b } of pendingLinks) {
    for (const h of [a, b]) {
      if (!handles.has(h)) throw new ParseError(line, `link refers to unknown handle "${h}" (name a bubble with "#${h}" at the end of its line)`);
    }
    if (a === b) throw new ParseError(line, "a link needs two different bubbles");
    links.push([a, b]);
  }

  if (!threads.length) throw new ParseError(lines.length, "no threads found");
  return { actors, threads, links };
}

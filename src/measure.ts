import type { Measured, Style } from "./types.js";
import { lerp } from "./rng.js";

/** Greedy word wrap. A single word longer than maxChars stays on its own line. */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxChars) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Wrap, then tighten: shrink the width until the line count would grow,
 * so lines come out roughly even instead of one long line and one short word.
 */
export function wrapBalanced(text: string, maxChars: number): string[] {
  const first = wrapText(text, maxChars);
  if (first.length < 2) return first;
  let best = first;
  for (let width = maxChars - 1; width >= 4; width--) {
    const attempt = wrapText(text, width);
    if (attempt.length > first.length) break;
    best = attempt;
  }
  return best;
}

export function measureBubble(text: string, style: Style, rng: () => number, burst = false): Measured {
  const lines = wrapBalanced(text.toUpperCase(), style.wrap);
  const longest = Math.max(...lines.map((l) => l.length));
  const textW = Math.round(longest * style.charWidth * style.fontSize);
  const textH = Math.round(lines.length * style.fontSize * style.lineHeight);
  // Bursts hug their text: the spiky outline supplies the breathing room.
  const padMin = burst ? 0.2 : style.padding.min;
  const padMax = burst ? 0.3 : style.padding.max;
  const padX = Math.round(style.fontSize * lerp(padMin, padMax, rng()));
  const padY = Math.round(style.fontSize * lerp(padMin, padMax, rng()) * 0.7);
  return { lines, textW, textH, padX, padY, w: textW + 2 * padX, h: textH + 2 * padY };
}

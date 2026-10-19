#!/usr/bin/env node
// Right arm, right hand and a held item that is not a tile. Same fitted hand as
// spike/pose.mjs (see spike/hand.mjs); the item's bar lies along the grip axis.
//
// usage: node spike/blind-test/hold.mjs <theta> <mode> <itemPart> <itemColour> [armColour] [handColour] [wristDegrees]
//   mode: none        -> arm and hand only
//         book        -> 24093-shaped: spine (local Y) along the grip, cover (local Z) rising from the hand, face (local X) to the viewer
//         book-down   -> as book, cover hanging below the hand
//         hang:hx,hy,hz -> an upright part hung from the grip by a handle bar at local (hx, hy, hz)
//         bar         -> a part whose bar runs along its own -Y from the origin, laid along the grip axis
import { limb, limbLines, add, sc, mv, cross, norm, cols, f6 } from '../hand.mjs';
const [theta = 20, mode = 'none', item = '', itemColour = 19, armColour = 15, handColour = 14, wrist = 0] = process.argv.slice(2);
const l = limb('right', theta, wrist);
const { grip, axis: u, L, N } = l;
console.log(limbLines('right', theta, wrist, armColour, handColour).join('\n'));
console.log(`0 grip at ${f6(grip)}; bar axis ${f6(u)}; up ${f6(L)}; to viewer ${f6(N)}`);
// (N, uS, L) right-handed
const uS = cross(L, N)[0] * u[0] + cross(L, N)[1] * u[1] + cross(L, N)[2] * u[2] > 0 ? u : sc(u, -1);
if (mode === 'book') {
  console.log(`0 ---- book in the right hand, spine in the grip, cover rising`);
  console.log(`1 ${itemColour} ${f6(grip)} ${f6(cols(N, uS, L))} ${item}`);
} else if (mode === 'book-down') {
  console.log(`0 ---- book in the right hand, spine in the grip, cover hanging`);
  console.log(`1 ${itemColour} ${f6(grip)} ${f6(cols(N, sc(uS, -1), sc(L, -1)))} ${item}`);
} else if (mode.startsWith('hang')) {
  const [hx, hy, hz] = mode.split(':')[1].split(',').map(Number);
  const X = norm([u[0], 0, u[2]]), Y = [0, 1, 0], Z = cross(X, Y);
  const R = cols(X, Y, Z);
  console.log(`0 ---- bag hanging from the right hand by its handle`);
  console.log(`1 ${itemColour} ${f6(add(grip, sc(mv(R, [hx, hy, hz]), -1)))} ${f6(R)} ${item}`);
} else if (mode === 'bar') {
  const Y = sc(uS, uS[0] > 0 ? 1 : -1), X = L, Z = cross(X, Y);
  console.log(`0 ---- bar held in the right hand`);
  console.log(`1 ${itemColour} ${f6(grip)} ${f6(cols(X, Y, Z))} ${item}`);
}

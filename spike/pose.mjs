#!/usr/bin/env node
// Prints the LDraw lines for a minifig's right arm, right hand and a held tile-shaped
// item, with the arm swung forward by THETA degrees. The hand is fitted to the arm's
// cuff socket and the item's bottom edge lies along the grip axis (see spike/hand.mjs).
//
// usage: node spike/pose.mjs <theta> <itemPart> <itemColour> [itemLength] [armColour] [handColour] [wristDegrees]
// e.g.   node spike/pose.mjs 50 3069b.dat 19 40 15 14
// For a book, a bag or a bar see spike/blind-test/hold.mjs.
import { limb, limbLines, add, sc, cross, cols, f6 } from './hand.mjs';
const [theta = 35, item = '3069b.dat', itemColour = 19, itemLength = 40, armColour = 15, handColour = 14, wrist = 0] = process.argv.slice(2);
const l = limb('right', theta, wrist);
// tile local: x -> L (length, up), -y -> N (stud face to the viewer), z -> x cross y (along the bar)
const X = l.L, Y = sc(l.N, -1), Z = cross(X, Y);
const centre = add(add(l.grip, sc(l.L, Number(itemLength) / 2 - 4)), sc(l.N, 4));
console.log(limbLines('right', theta, wrist, armColour, handColour).join('\n'));
console.log(`0 ---- item in the right hand, bottom edge in the grip`);
console.log(`1 ${itemColour} ${f6(centre)} ${f6(cols(X, Y, Z))} ${item}`);

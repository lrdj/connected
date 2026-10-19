// Minifig arm and hand placement, fitted from the parts' own geometry (20 Oct 2026).
//
// The MLCad offsets this spike started with were wrong for the current library parts:
// the hand's peg pointed almost straight up, so it came out through the front of the
// forearm, and held items were set across the grip instead of inside it. The facts:
//   3818/3819  cuff socket mouth at (∓5, 18.9, -9.9) in arm space; socket axis runs
//              (0, -0.707, 0.707), up into the forearm (s\3818s01.dat).
//   3820       peg is a cylinder along +Z from the origin, 13 long; grip centre at
//              (0, -0.8229, -9.8948); the grip is a half-cylinder whose axis is the
//              hand's Y tilted 14.5 degrees toward -Z: g = (0, -0.968, -0.250).
// So: hand origin at the socket mouth, hand +Z along the socket axis, grip axis across
// the body (arm X) at wrist 0. A held item's bar lies along the grip axis through the
// grip centre. `wrist` rolls the hand about the peg.
export const d = Math.PI / 180;
export const mul = (a, b) => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]); return r; };
export const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sc = (a, k) => a.map((v) => v * k);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => sc(a, 1 / Math.hypot(...a));
export const cols = (X, Y, Z) => [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
export const f6 = (v) => v.map((x) => +x.toFixed(5)).join(' ');
export const Rz = (deg) => { const c = Math.cos(deg * d), s = Math.sin(deg * d); return [c, s, 0, -s, c, 0, 0, 0, 1]; };
export const Rx = (deg) => { const c = Math.cos(deg * d), s = Math.sin(deg * d); return [1, 0, 0, 0, c, s, 0, -s, c]; };
const Rpeg = (deg) => { const c = Math.cos(deg * d), s = Math.sin(deg * d); return [c, -s, 0, s, c, 0, 0, 0, 1]; };

export const GRIP = [0, -0.8229, -9.8948];
export const GRIP_AXIS = norm([0, -0.96815, -0.25038]);
export const VIEWER = norm([-1, 0, -1]);

// side 'right' | 'left'; theta swings the arm forward in degrees; wrist rolls the hand about the peg.
export function limb(side = 'right', theta = 0, wrist = 0) {
  const sgn = side === 'right' ? -1 : 1;
  const pivot = [sgn * 15.552, 8, 0];
  const M = mul(Rz(sgn * 9.79), Rx(Number(theta)));
  const cuff = [sgn * 5, 18.9, -9.9];
  const s = [0, -Math.SQRT1_2, Math.SQRT1_2];
  const Y = [1, 0, 0], Z = s, X = cross(Y, Z);
  const H = mul(M, mul(cols(X, Y, Z), Rpeg(Number(wrist))));
  const pos = add(pivot, mv(M, cuff));
  const grip = add(pos, mv(H, GRIP));
  const axis = norm(mv(H, GRIP_AXIS));                     // bar axis of a held item
  const up = [0, -1, 0];
  const L = norm(add(up, sc(axis, -dot(up, axis))));       // most upward direction perpendicular to the bar
  let N = cross(axis, L); if (dot(N, VIEWER) < 0) N = sc(N, -1);   // toward the viewer
  const armPart = side === 'right' ? '3818.dat' : '3819.dat';
  return { sgn, pivot, M, pos, H, grip, axis, L, N, armPart };
}

export function limbLines(side, theta, wrist, armColour = 15, handColour = 14) {
  const l = limb(side, theta, wrist);
  const label = side === 'right' ? 'right' : 'left';
  return [
    `0 ---- ${label} arm, ${Number(theta) ? `raised ${theta} degrees` : 'at rest'}`,
    `1 ${armColour} ${f6(l.pivot)} ${f6(l.M)} ${l.armPart}`,
    `0 ---- ${label} hand (peg in the cuff socket, grip axis across the body)`,
    `1 ${handColour} ${f6(l.pos)} ${f6(l.H)} 3820.dat`,
  ];
}

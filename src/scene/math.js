/* Shared numbers and small maths for the scene: 1,728 cubes, a seeded random source and quaternions. */
export const N = 1728;          // 12 x 12 x 12
export const SP = 0.27;         // grid pitch
export const FLOOR = -2.6;
export const TAU = Math.PI * 2;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rnd) { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); }
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x) => x * x * (3 - 2 * x);
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function qmul(ax, ay, az, aw, bx, by, bz, bw, o, k) {
  o[k] = aw * bx + ax * bw + ay * bz - az * by;
  o[k + 1] = aw * by - ax * bz + ay * bw + az * bx;
  o[k + 2] = aw * bz + ax * by - ay * bx + az * bw;
  o[k + 3] = aw * bw - ax * bx - ay * by - az * bz;
}
export function yawPitch(yaw, pitch, o) {
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
  // pitch(x) * yaw(y)
  qmul(sp, 0, 0, cp, 0, sy, 0, cy, o, 0);
}
export function randQuat(rnd, o, k) {
  const u1 = rnd(), u2 = rnd(), u3 = rnd();
  const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
  o[k] = s1 * Math.sin(TAU * u2); o[k + 1] = s1 * Math.cos(TAU * u2);
  o[k + 2] = s2 * Math.sin(TAU * u3); o[k + 3] = s2 * Math.cos(TAU * u3);
}

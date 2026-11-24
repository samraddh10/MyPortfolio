/* car:start */
// A generic open-wheel race car as voxels, in metres: x forward, y up, z sideways.
// Returns the visible shell for a given voxel pitch: [{x, y, z, role, wheel}] with
// roles 0 = white, 1 = grey, 2 = dark (tyres, floor), 3 = red.
export function carVoxels(pitch) {
  const WHITE = 0, GREY = 1, DARK = 2, RED = 3;
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  const WHEELS = [
    { x: 1.78, r: 0.34, zin: 0.7, zout: 0.99 },
    { x: -1.86, r: 0.37, zin: 0.57, zout: 0.99 },
  ];
  function part(x, y, z) {
    const az = Math.abs(z);
    for (let w = 0; w < WHEELS.length; w++) {
      const W = WHEELS[w], d = Math.hypot(x - W.x, y - W.r);
      if (az >= W.zin && az <= W.zout && d <= W.r) {
        if (d < W.r * 0.42) return [GREY, w];
        const ang = Math.atan2(y - W.r, x - W.x);
        const mark = az > W.zout - pitch * 1.5 && d > W.r * 0.6 && d < W.r * 0.86 && ((ang + 7 * Math.PI) % (Math.PI / 2)) < 0.42;
        return [mark ? WHITE : DARK, w];
      }
    }
    // suspension: upper and lower arms to each wheel
    for (const W of WHEELS) for (const yy of [0.2, 0.42]) {
      if (Math.abs(x - W.x) < 0.05 && Math.abs(y - yy) < 0.04 && az > 0.18 && az < W.zin) return [GREY, -1];
    }
    // helmet
    if (Math.hypot(x - 0.3, y - 0.64, z) < 0.12) return [x > 0.34 && y > 0.62 && y < 0.69 ? DARK : WHITE, -1];
    // halo: hoop over the cockpit, centre pillar to the front, legs to the body
    {
      const e = ((x - 0.33) / 0.44) ** 2 + (z / 0.28) ** 2;
      if (y >= 0.78 && y <= 0.86 && e >= 0.75 && e <= 1.2 && x < 0.62) return [GREY, -1];
      if (az < 0.045 && x >= 0.62 && x <= 1.0 && Math.abs(y - lerp(0.84, 0.6, inv(0.62, 1.0, x))) < 0.045) return [GREY, -1];
      if (x > -0.16 && x < -0.04 && az > 0.18 && az < 0.3 && y > 0.6 && y < 0.82) return [GREY, -1];
    }
    // cockpit opening
    if (x > 0.02 && x < 0.82 && az < 0.22 && y > 0.48) return [0, -1];
    // monocoque and nose
    if (x >= -0.35 && x <= 2.78) {
      const t = inv(1.1, 2.78, x);
      const hw = x < 1.1 ? 0.38 : lerp(0.25, 0.09, t);
      const top = x < 1.1 ? 0.63 : lerp(0.59, 0.29, t);
      const bot = x < 1.1 ? 0.12 : lerp(0.15, 0.19, t);
      if (az <= hw && y >= bot && y <= top) return [x > 2.5 || (az < 0.06 && y > top - 0.06) ? WHITE : RED, -1];
    }
    // sidepods, with a white stripe along the top
    if (x >= -1.35 && x <= 0.7) {
      const t = inv(0.7, -1.35, x);
      const outer = lerp(0.79, 0.4, t * t), top = lerp(0.53, 0.33, t);
      if (az >= 0.3 && az <= outer && y >= 0.12 && y <= top) return [y > top - 0.075 ? WHITE : RED, -1];
    }
    // engine cover, airbox and shark fin
    if (x >= -0.58 && x <= -0.12 && az <= 0.17 && y >= 0.6 && y <= 0.99) return [x > -0.24 && y > 0.8 && az < 0.11 ? DARK : RED, -1];
    if (x >= -2.2 && x < -0.3) {
      const t = inv(-0.3, -2.2, x);
      const hw = lerp(0.36, 0.1, t), top = lerp(0.9, 0.42, Math.pow(t, 0.8));
      if (az <= hw && y >= 0.12 && y <= top) return [RED, -1];
      if (az <= 0.035 && y > top && y <= top + 0.16 && x > -1.95 && x < -0.55) return [WHITE, -1];
    }
    // floor
    {
      const edge = x > 0.75 ? 0.45 : 0.74;
      const cover = x >= -1.35 && x <= 0.7 ? lerp(0.79, 0.4, inv(0.7, -1.35, x) ** 2) : x > 0.7 ? 0.25 : lerp(0.36, 0.1, inv(-0.3, -2.2, x));
      if (x >= -2.25 && x <= 1.35 && y >= 0.04 && y <= 0.04 + pitch && az <= edge && az >= cover - pitch) return [DARK, -1];
    }
    // front wing: white main plane, red flaps rising to the rear, red endplates
    if (x >= 2.22 && x <= 2.9 && az <= 0.98) {
      if (az >= 0.92 && y >= 0.03 && y <= 0.31) return [RED, -1];
      if (y >= 0.05 && y <= 0.11) return [WHITE, -1];
      if (x < 2.58 && az > 0.16 && y > 0.11 && y <= 0.11 + (2.58 - x) * 0.55) return [RED, -1];
    }
    // rear wing: white endplates and beam wing, red planes, grey pillar
    if (x >= -2.98 && x <= -2.32) {
      if (az >= 0.5 && az <= 0.58 && y >= 0.3 && y <= 1.0) return [WHITE, -1];
      if (az < 0.5 && y >= 0.72 && y <= 0.81 && x <= -2.42) return [RED, -1];
      if (az < 0.5 && y >= 0.86 && y <= 0.96 && x <= -2.62) return [RED, -1];
      if (az < 0.5 && y >= 0.38 && y <= 0.45 && x <= -2.5) return [WHITE, -1];
      if (az < 0.05 && y > 0.45 && y < 0.72 && x <= -2.52 && x >= -2.72) return [GREY, -1];
    }
    // mirrors
    if (x >= 0.7 && x <= 0.84 && az >= 0.42 && az <= 0.58 && y >= 0.54 && y <= 0.64) return [WHITE, -1];
    return [-1, -1];
  }
  const X0 = -3.0, X1 = 2.95, Y1 = 1.02, Z1 = 1.0;
  const nx = Math.ceil((X1 - X0) / pitch), ny = Math.ceil(Y1 / pitch), nz = Math.ceil((2 * Z1) / pitch);
  const role = new Int8Array(nx * ny * nz).fill(-1), wheel = new Int8Array(nx * ny * nz).fill(-1);
  const at = (i, j, k) => (i * ny + j) * nz + k;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const p = part(X0 + (i + 0.5) * pitch, (j + 0.5) * pitch, -Z1 + (k + 0.5) * pitch);
    role[at(i, j, k)] = p[0];
    wheel[at(i, j, k)] = p[1];
  }
  const filled = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && role[at(i, j, k)] >= 0;
  const out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (!filled(i, j, k)) continue;
    const inward = k < nz / 2 ? k + 1 : k - 1, outward = k < nz / 2 ? k - 1 : k + 1;
    const openXY = !filled(i + 1, j, k) || !filled(i - 1, j, k) || !filled(i, j + 1, k) || !filled(i, j - 1, k);
    if (!openXY && filled(i, j, outward) && (filled(i, j, inward) || wheel[at(i, j, k)] >= 0)) continue;
    out.push({ x: X0 + (i + 0.5) * pitch, y: (j + 0.5) * pitch, z: -Z1 + (k + 0.5) * pitch, role: role[at(i, j, k)], wheel: wheel[at(i, j, k)] });
  }
  out.wheels = WHEELS;
  return out;
}
/* car:end */

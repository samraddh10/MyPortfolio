/* Portrait: the page never keeps a photo. It keeps a 72 x 96 grid of brightness
   levels (one character each, 64 steps) and draws the portrait from dots (or cubes) and text. */
export const PCOLS = 72, PROWS = 96;
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

let placeholderCache = null;
function placeholderLevels() {
  if (placeholderCache) return placeholderCache;
  const L = new Array(PCOLS * PROWS);
  for (let r = 0; r < PROWS; r++) for (let c = 0; c < PCOLS; c++) {
    const x = (c + 0.5) / PCOLS, y = (r + 0.5) / PROWS;
    const hx = (x - 0.5) / 0.2, hy = (y - 0.37) / 0.235;          // head
    const sx = (x - 0.5) / 0.47, sy = (y - 1.04) / 0.33;          // shoulders
    const nk = Math.abs(x - 0.5) < 0.085 && y > 0.52 && y < 0.75;  // neck
    const head = hx * hx + hy * hy, body = sx * sx + sy * sy;
    let v = 0.93 - 0.08 * Math.hypot(x - 0.5, y - 0.45);           // soft background
    if (head < 1 || body < 1 || nk) {
      const nx = head < 1 ? hx : nk ? (x - 0.5) / 0.085 : sx;      // fake light from the upper left
      const ny = head < 1 ? hy : nk ? 0 : sy;
      v = 0.16 + 0.22 * Math.max(0, Math.min(1, 0.55 + 0.45 * (nx * 0.7 + ny * 0.5)));
    }
    L[r * PCOLS + c] = v;
  }
  placeholderCache = L;
  return L;
}

// { cols, rows, L: brightness 0..1 (1 = light), real: whether it came from a photo }
export function portraitGrid(p) {
  const lv = p && typeof p.portrait === 'string' ? p.portrait : '';
  if (lv.length === PCOLS * PROWS && /^[0-9A-Za-z_-]+$/.test(lv)) {
    const L = new Array(lv.length);
    for (let i = 0; i < lv.length; i++) L[i] = ALPHA.indexOf(lv[i]) / 63;
    return { cols: PCOLS, rows: PROWS, L, real: true };
  }
  return { cols: PCOLS, rows: PROWS, L: placeholderLevels(), real: false };
}

const RAMP = ' .,:;-=+*%#@';
export function asciiPortrait(p) {
  const g = portraitGrid(p), lines = [];
  for (let r = 0; r < g.rows; r += 2) {
    let line = '';
    for (let c = 0; c < g.cols; c++) {
      const v = (g.L[r * g.cols + c] + g.L[(r + 1) * g.cols + c]) / 2;
      line += RAMP[Math.min(RAMP.length - 1, Math.floor((1 - v) * RAMP.length))];
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

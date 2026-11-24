/* Themes: each section names one; colours blend at section boundaries. */

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const THEME_DEFS = {
  // css: bg, raised, ink, ink-2, muted, hairline, accent, text on accent
  // cubes: base, mid, light | glow: two soft colour fields behind the scene | grain: film-grain strength
  concrete: { css: ['#e2e4e0', '#eceeea', '#1b1e21', '#33383d', '#596066', '#c3c7c2', '#2944d1', '#ffffff'], cubes: ['#2a2e33', '#7c838a', '#c4c8c4'], shadow: 0.15, glow: ['#c9d1e4', '#d3d9cd'], grain: 0.06, rim: '#3d6df2' },
  terminal: { css: ['#111618', '#182023', '#e2e8e6', '#b9c4c1', '#84918d', '#29343a', '#4dab98', '#0c1112'], cubes: ['#c3ccc9', '#6b7875', '#3b4649'], shadow: 0.42, glow: ['#1f4a43', '#0a1c20'], grain: 0.085, rim: '#7ff0d6' },
  paper: { css: ['#e9e7ef', '#f3f2f7', '#1e1b26', '#3a3647', '#676277', '#cfcbda', '#6343d0', '#ffffff'], cubes: ['#2c2935', '#868198', '#cac6d6'], shadow: 0.14, glow: ['#d3c8f3', '#f2eef8'], grain: 0.06, rim: '#7b54f5' },
  nebula: { css: ['#170e2e', '#21143f', '#f1ecfb', '#d6cdea', '#b5acd0', '#3b2c5e', '#a98cff', '#140c26'], cubes: ['#ece5ff', '#9486bd', '#2a1f48'], shadow: 0.45, glow: ['#4a25a3', '#2b1466'], grain: 0.09, rim: '#d9c8ff' },
  deep: { css: ['#07090d', '#0e1118', '#e8ecf5', '#c3cad8', '#8a93a6', '#1c2230', '#7fa2ff', '#0a0d14'], cubes: ['#dfe7ff', '#7d8aa8', '#2a3142'], shadow: 0.3, glow: ['#18265a', '#0a0c13'], grain: 0.1, rim: '#9dbbff' },
  pitlane: { css: ['#2a0e0c', '#361311', '#f4ebe9', '#dcc9c6', '#b8958f', '#4e2521', '#ff5a43', '#1f0a08'], cubes: ['#f3eeec', '#9a7470', '#1d0b0a'], shadow: 0.5, glow: ['#a3291d', '#5e1610'], grain: 0.095, rim: '#ffe2c4' },
};
for (const k in THEME_DEFS) { const d = THEME_DEFS[k]; d.c = d.css.map(hex); d.k = d.cubes.map(hex).concat([d.c[6]]); d.g = d.glow.map(hex); d.r = hex(d.rim); }
const CSS_VARS = ['--concrete', '--concrete-2', '--ink', '--ink-2', '--steel', '--hairline', '--cobalt', '--on-cobalt'];
// Live, blended theme. The scene reads it every frame.
export const THEME = { c: THEME_DEFS.concrete.c.map((x) => x.slice()), k: THEME_DEFS.concrete.k.map((x) => x.slice()), g: THEME_DEFS.concrete.g.map((x) => x.slice()), shadow: 0.15, grain: 0.06, rim: THEME_DEFS.concrete.r.slice(), key: '' };
const lastCss = [];
export function applyTheme(a, b, t) {
  const A = THEME_DEFS[a] || THEME_DEFS.concrete, B = THEME_DEFS[b] || THEME_DEFS.concrete;
  const mix = (x, y, o) => { o[0] = x[0] + (y[0] - x[0]) * t; o[1] = x[1] + (y[1] - x[1]) * t; o[2] = x[2] + (y[2] - x[2]) * t; };
  for (let i = 0; i < 8; i++) mix(A.c[i], B.c[i], THEME.c[i]);
  for (let i = 0; i < 4; i++) mix(A.k[i], B.k[i], THEME.k[i]);
  THEME.shadow = A.shadow + (B.shadow - A.shadow) * t;
  for (let i = 0; i < 2; i++) mix(A.g[i], B.g[i], THEME.g[i]);
  mix(A.r, B.r, THEME.rim);
  THEME.grain = A.grain + (B.grain - A.grain) * t;
  const extra = [['--glow-a', 'rgb(' + THEME.g[0].map((x) => Math.round(x * 255)).join(' ') + ')'], ['--glow-b', 'rgb(' + THEME.g[1].map((x) => Math.round(x * 255)).join(' ') + ')'], ];
  extra.forEach(([k, v], j) => { if (lastCss[10 + j] !== v) { lastCss[10 + j] = v; document.documentElement.style.setProperty(k, v); } });
  const root = document.documentElement.style;
  for (let i = 0; i < 8; i++) {
    const v = 'rgb(' + THEME.c[i].map((x) => Math.round(x * 255)).join(' ') + ')';
    if (lastCss[i] !== v) { lastCss[i] = v; root.setProperty(CSS_VARS[i], v); }
  }
  const bg = THEME.c[0], dark = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] < 0.45 ? 'dark' : 'light';
  if (lastCss[8] !== dark) { lastCss[8] = dark; root.colorScheme = dark; }
}

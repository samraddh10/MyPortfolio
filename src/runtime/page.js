/* Page behaviour that runs outside React's render: section measurements and the
   scroll-linked state (theme blend, progress bar, active nav link, title width, screenshot tilt). */
import { $, $$, gate, layoutCache, runtime, reduceMotion, DIVE_MS } from './state.js';
import { applyTheme } from './theme.js';
import { lqBars } from './liquid.js';

function absTop(el) {
  let y = 0;
  while (el) { y += el.offsetTop; el = el.offsetParent; }
  return y;
}

export function measure() {
  const app = document.getElementById('app');
  if (!app) return;
  layoutCache.sections = $$('[data-scene]', app).map((el) => ({
    el,
    scene: el.dataset.scene,
    plates: +el.dataset.plates || 6,
    theme: el.dataset.theme || 'concrete',
    side: el.dataset.side === 'left' ? -1 : 1,
    top: absTop(el),
    height: el.offsetHeight,
  }));
  layoutCache.shots = $$('[data-shot]', app).map((el) => ({ el, top: absTop(el) }));
  layoutCache.navs = $$('[data-nav]', app).map((el) => ({ name: el.dataset.nav, top: absTop(el) }));
  layoutCache.docH = document.documentElement.scrollHeight;
  layoutCache.bar = $('.progress', app);
  layoutCache.titles = $$('.project', app).map((sec) => ({ el: $('.project-name', sec), top: absTop(sec), w: -1 }));
  const scene = runtime.scene, current = runtime.content;
  if (scene) { scene.setSections(layoutCache.sections); scene.setPortrait(current.profile); scene.setShape(current.settings && current.settings.particles); }
}

function updatePage() {
  const y = scrollY, vh = innerHeight;
  // theme blend: a short window around each section boundary keeps text legible
  {
    const secs = layoutCache.sections;
    let a = secs.length ? secs[0].theme : 'concrete', b = a, t = 0;
    const w = vh * 0.28;
    for (let k = 1; k < secs.length; k++) {
      const boundary = secs[k].top - vh * 0.5;
      if (y >= boundary - w) { a = secs[k - 1].theme; b = secs[k].theme; t = Math.min(1, Math.max(0, (y - boundary + w) / (2 * w))); }
    }
    if (gate.state === 'wait') applyTheme('deep', 'deep', 0);
    else if (gate.state === 'dive') {
      const k = Math.min(1, (performance.now() - gate.start) / DIVE_MS);
      const kk = Math.min(1, Math.max(0, (k - 0.78) / 0.2));
      document.documentElement.classList.toggle('is-surfacing', k > 0.9);
      applyTheme('deep', a, kk * kk * (3 - 2 * kk));
    } else applyTheme(a, b, t * t * (3 - 2 * t));
  }
  const max = Math.max(1, layoutCache.docH - vh);
  const bar = layoutCache.bar;
  if (bar) bar.style.setProperty('--progress', (y / max).toFixed(4));
  let nav = 'Top';
  for (const n of layoutCache.navs) if (n.top <= y + vh * 0.42) nav = n.name;
  const navBar = lqBars.get('nav');
  if (navBar) navBar.sync(nav);
  if (!reduceMotion) {
    // project names widen from condensed to expanded as their section arrives
    for (const ti of layoutCache.titles || []) {
      if (!ti.el) continue;
      let p = (vh * 0.95 - (ti.top - y)) / (vh * 0.6);
      p = Math.min(1, Math.max(0, p));
      const w = Math.round((76 + 38 * (1 - Math.pow(1 - p, 3))) * 2) / 2;
      if (w !== ti.w) { ti.w = w; ti.el.style.fontStretch = w + '%'; }
    }
    for (const s of layoutCache.shots) {
      const top = s.top - y;
      let p = (vh * 1.02 - top) / (vh * 0.62);
      p = Math.min(1, Math.max(0, p));
      p = 1 - Math.pow(1 - p, 3);
      if (s.p !== p) { s.p = p; s.el.style.setProperty('--p', p.toFixed(4)); }
    }
  }
}

// Measures now and whenever the layout can move, and runs the scroll loop every frame.
export function startPage() {
  const app = document.getElementById('app');
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener('load', measure);
  addEventListener('resize', () => requestAnimationFrame(measure));
  if ('ResizeObserver' in window) { let rq; new ResizeObserver(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(measure); }).observe(app); }
  (function loop() { updatePage(); requestAnimationFrame(loop); })();
}

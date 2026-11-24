/* Welcome screen: dark, with the dot sphere behind. Entering dives through it into the page.
   The inline script in index.html adds html.gated before the first paint, once per visit. */
import { $, gate, DIVE_MS } from './state.js';
import { measure } from './page.js';
import { wakeLiquid } from './liquid.js';
import { decodeVisible } from './decode.js';

export function enterPortfolio() {
  if (gate.state !== 'wait') return;
  gate.state = 'dive'; gate.start = performance.now();
  try { sessionStorage.setItem('portfolio-entered', '1'); } catch (e) { /* private mode */ }
  const root = document.documentElement;
  root.classList.add('is-diving');
  scrollTo(0, 0);
  // the 3D scene ends the dive on its own frame clock; this covers pages without WebGL
  const tick = () => {
    if (gate.state !== 'dive') return;
    if (performance.now() - gate.start >= DIVE_MS) finishGate(); else setTimeout(tick, 250);
  };
  setTimeout(tick, DIVE_MS + (document.getElementById('stage').classList.contains('is-live') ? 1500 : 0));
}

export function finishGate() {
  if (gate.state !== 'dive') return;
  gate.state = 'done';
  document.documentElement.classList.remove('gated', 'is-diving', 'is-surfacing');
  requestAnimationFrame(wakeLiquid);
  requestAnimationFrame(decodeVisible);
  measure();
  const h = $('.hero-name');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

// Keys, the wheel and an upward swipe also enter; a click is handled by the Gate component.
export function bindGate() {
  window.__gateReady = true;   // tells the inline script's fallback that the page is running
  if (gate.state !== 'wait') return;
  addEventListener('keydown', (ev) => { if (gate.state === 'wait' && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); enterPortfolio(); } });
  addEventListener('wheel', (ev) => { if (gate.state === 'wait' && ev.deltaY > 8) enterPortfolio(); }, { passive: true });
  let ty = null;
  addEventListener('touchstart', (ev) => { ty = ev.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (ev) => { if (gate.state === 'wait' && ty !== null && ty - ev.touches[0].clientY > 30) enterPortfolio(); }, { passive: true });
  const b = $('#gate-enter');
  if (b && matchMedia('(hover: hover)').matches) requestAnimationFrame(() => b.focus({ preventScroll: true }));
}

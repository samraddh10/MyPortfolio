/* Headings that arrive as a row of dots and resolve into letters.
   <DecodeText> and <NameLines> render each letter as its own span (screen readers get the
   words from a hidden copy); this module plays them. The letters show as dots, flicker
   through a few letters, then settle. When a heading leaves the screen completely it
   turns back into dots, so it plays again on the way back. */
import { gate, reduceMotion } from './state.js';

export const DECODE_ON = !reduceMotion && 'IntersectionObserver' in window;
const decodeEls = new Set();
let decodeIO = null;

function resetDecode(el) {
  el._run = (el._run || 0) + 1;
  el._chars.forEach((c) => { c.className = 'dc is-dot'; delete c.dataset.g; delete c.dataset.b; });
  el.dataset.decState = 'dots';
}

function runDecode(el) {
  const id = (el._run = (el._run || 0) + 1);
  const chars = el._chars, pool = el._pool;
  chars.forEach((c) => { c.className = 'dc is-dot'; });
  el.dataset.decState = 'running';
  const step = Math.min(38, 760 / Math.max(1, chars.length)), t0 = performance.now();
  const tick = () => {
    if (el._run !== id || !el.isConnected) return;
    const t = performance.now() - t0;
    let done = true;
    chars.forEach((c, i) => {
      const s0 = 90 + i * step;
      if (t < s0) { done = false; return; }                       // still a dot
      if (t < s0 + 210) {                                         // flickers through a few letters
        done = false;
        const bucket = String(Math.floor((t - s0) / 70));
        if (c.dataset.b !== bucket) { c.dataset.b = bucket; c.dataset.g = pool[(Math.random() * pool.length) | 0] || '•'; }
        if (c.className !== 'dc is-scr') c.className = 'dc is-scr';
        return;
      }
      if (c.className !== 'dc') { c.className = 'dc'; delete c.dataset.g; }
    });
    if (done) el.dataset.decState = 'done'; else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Headings on the page wait behind the welcome screen; the welcome screen's own name plays at once.
const hiddenByGate = (el) => {
  const app = document.getElementById('app');
  return !!app && app.contains(el) && (gate.state === 'wait' || gate.state === 'dive');
};

function observer() {
  if (!decodeIO) {
    decodeIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target;
        if (e.intersectionRatio >= 0.5) {
          if (el.dataset.decState === 'dots' && !hiddenByGate(el)) runDecode(el);
        } else if (!e.isIntersecting && el.dataset.decState !== 'dots') resetDecode(el);
      }
    }, { threshold: [0, 0.5] });
  }
  return decodeIO;
}

// Ref callback for a heading whose letters are rendered as .dc spans next to a .sr-copy.
export function decodeRef(el) {
  if (!el) return;
  el._chars = Array.from(el.querySelectorAll('.dc'));
  el._pool = Array.from(el.querySelector('.sr-copy').textContent.replace(/\s/g, ''));
  resetDecode(el);
  decodeEls.add(el);
  observer().observe(el);
  return () => { decodeEls.delete(el); observer().unobserve(el); el._run = (el._run || 0) + 1; };
}

// After the welcome screen: play whatever headings are already on screen.
export function decodeVisible() {
  for (const el of decodeEls) {
    if (!el.isConnected || el.dataset.decState !== 'dots') continue;
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight && r.width) runDecode(el);
  }
}

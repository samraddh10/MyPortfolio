/* Shared, mutable runtime state. The page loop, the 3D scene, the liquid nav and the
   welcome screen all read and write these objects, so they live in one place. */

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// The inline script in index.html decides before the first paint whether to show the welcome screen.
export const DIVE_MS = reduceMotion ? 350 : 2100;
export const gate = { state: document.documentElement.classList.contains('gated') ? 'wait' : 'off', start: 0, k: 0 };

// Section positions, measured from the DOM whenever the layout changes.
export const layoutCache = { sections: [], shots: [], navs: [], docH: 1, bar: null, titles: [] };

// content: the site's data. scene: the Three.js scene's state once it is running.
export const runtime = { content: null, scene: null };

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

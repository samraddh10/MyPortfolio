/* Starts everything that runs outside React's render: the welcome screen's listeners,
   the scroll loop and the 3D scene. They live for the whole visit, so this runs once. */
import { runtime } from './state.js';
import { bindGate } from './gate.js';
import { watchLiquid } from './liquid.js';
import { startPage } from './page.js';
import { initScene } from '../scene/stage.js';

let booted = false;

export function bootRuntime(content) {
  if (booted) return;
  booted = true;
  runtime.content = content;
  bindGate();
  watchLiquid();
  startPage();
  initScene();
}

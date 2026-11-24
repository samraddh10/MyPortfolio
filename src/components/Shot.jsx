import { useRef, useState } from 'react';
import { measure } from '../runtime/page.js';
import { reduceMotion } from '../runtime/state.js';

const canTilt = !reduceMotion && matchMedia('(hover: hover)').matches;

// A screenshot in a browser frame that leans towards the pointer, with thumbnails to swap it.
// The page loop sets --p on the figure as it scrolls in; the pointer sets --rx/--ry.
export function Shot({ images, host, name }) {
  const [sel, setSel] = useState(0);        // highlighted thumbnail
  const [shown, setShown] = useState(0);    // image in the frame, swapped after a short fade
  const [swapping, setSwapping] = useState(false);
  const figRef = useRef(null);
  const timer = useRef(0);
  const main = images[shown];

  const pick = (k) => {
    if (k === sel) return;
    setSel(k);
    setSwapping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setShown(k);
      setSwapping(false);
      requestAnimationFrame(measure);
    }, 180);
  };

  const tilt = canTilt ? {
    onPointerMove(ev) {
      const fr = ev.currentTarget, fig = figRef.current;
      const b = fr.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width, y = (ev.clientY - b.top) / b.height;
      fig.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
      fig.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
      fr.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      fr.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      fr.classList.add('is-tilting');
    },
    onPointerLeave(ev) {
      const fig = figRef.current;
      fig.style.setProperty('--ry', '0deg');
      fig.style.setProperty('--rx', '0deg');
      ev.currentTarget.classList.remove('is-tilting');
    },
  } : null;

  const wh = +main.w > 0 && +main.h > 0 ? { width: Math.round(+main.w), height: Math.round(+main.h) } : null;

  return (
    <figure className="shot" data-shot="" ref={figRef}>
      <div className="shot-frame" data-tilt="" {...tilt}>
        <div className="shot-bar" aria-hidden="true"><i /><i /><i /><span>{host}</span></div>
        <img
          className={'shot-img' + (swapping ? ' is-swapping' : '')}
          src={main.src}
          alt={main.alt || name + ' screenshot'}
          {...wh}
          data-shot-main=""
          onLoad={measure}
        />
      </div>
      {images.length > 1 && (
        <div className="shot-thumbs" role="group" aria-label={'More screenshots of ' + name}>
          {images.map((im, k) => (
            <button
              type="button"
              key={k}
              className={'shot-thumb' + (k === sel ? ' is-on' : '')}
              aria-pressed={k === sel}
              aria-label={'Show screenshot ' + (k + 1) + ': ' + (im.alt || '')}
              onClick={() => pick(k)}
            >
              <img className="thumb-img" src={im.src} alt="" />
            </button>
          ))}
        </div>
      )}
      <figcaption>{main.alt || ''}</figcaption>
    </figure>
  );
}

import { useEffect, useRef } from 'react';
import { LiquidBar, lqBars } from '../runtime/liquid.js';
import { ICONS } from './Icons.jsx';

// A row of links sitting on a thin layer of water. The water is drawn by a small WebGL
// shader (runtime/liquid.js); without WebGL the plain CSS drop stands in.
export function LiquidNav({ kind, className, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const bar = new LiquidBar(ref.current, { mark: kind === 'nav', follow: kind === 'foot' });
    lqBars.set(kind, bar);
    return () => { bar.destroy(); if (lqBars.get(kind) === bar) lqBars.delete(kind); };
  }, [kind]);
  return (
    <nav ref={ref} className={'lq ' + className} data-lq={kind} aria-label={label}>
      <canvas className="lq-water" aria-hidden="true" />
      <span className="lq-drop" aria-hidden="true" />
      {children}
    </nav>
  );
}

const EXT = { target: '_blank', rel: 'noopener' };

// One item: an icon that plays a small scene (fx) when picked, and a label.
export function LqItem({ href, label, icon, fx, external, ...rest }) {
  return (
    <a className="lq-item" href={href} data-fx={fx} {...(external ? EXT : null)} {...rest}>
      <span className="lq-ico">{ICONS[icon]}</span>
      <span className="lq-label">{label}</span>
    </a>
  );
}

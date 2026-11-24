/* Liquid nav: water under the links in the top bar and footer.
   Ported from Nimbus UI's "Waterline" navbar (React) to plain JS; the
   water layer is square-cornered and tinted with the page's colours. */
import { $, $$, gate, reduceMotion } from './state.js';
import { THEME } from './theme.js';

const LQ_PAD = 12;   // canvas bleed around the link row, for the drop's shadow and ripples
const LQ_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const LQ_FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;uniform vec3 uTint;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,0.);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=uTint*.3*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.25*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(1.),uTint,mix(.16,.42,uDark));
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=uTint;dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.2)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

function lqGL(canvas) {
  let gl = null;
  try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) { gl = null; }
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, LQ_VERT), fs = sh(gl.FRAGMENT_SHADER, LQ_FRAG);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'a');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  for (const n of ['uRes', 'uDpr', 'uTime', 'uPill', 'uBlob', 'uSy', 'uRip', 'uMouse', 'uDark', 'uAmb', 'uTint']) u[n] = gl.getUniformLocation(p, n);
  return { gl, u };
}

export class LiquidBar {
  // opts.mark: the drop shows which section you're in (top bar). opts.follow: the drop follows the pointer (footer).
  constructor(el, opts) {
    this.opts = opts || {};
    this.current = 0; this.lockUntil = 0;
    this.s = {
      a: { x: 0, v: 0 }, b: { x: 0, v: 0 }, sy: { s: 1, v: 0 }, lead: 0, lagFrom: 0, sats: [], rips: [],
      t: { x: 0, cy: 0, q: 0, r: 19 }, q: 0, mouse: { x: 0, y: 0, s: 0, on: false },
      moving: false, split: false, ready: false, w: 0, h: 0, visible: true, raf: 0, last: 0, time: 0,
    };
    // the water canvas and the CSS stand-in drop are rendered by the LiquidNav component
    this.canvas = el.querySelector('.lq-water');
    this.drop = el.querySelector('.lq-drop');
    this.glc = lqGL(this.canvas);
    this.io = new IntersectionObserver(([e]) => { this.s.visible = e.isIntersecting; if (this.s.visible) this.loop(); });
    this.ro = new ResizeObserver(() => { this.s.ready = false; this.measure(); });
    this.attach(el);
  }
  attach(el) {
    if (this.ac) this.ac.abort();
    this.ac = new AbortController();
    const sig = { signal: this.ac.signal };
    this.el = el;
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.glc = null; el.dataset.gl = 'off'; }, sig);
    el.dataset.gl = this.glc ? 'on' : 'off';
    this.items = $$('.lq-item', el);
    this.current = Math.min(this.current, Math.max(0, this.items.length - 1));
    this.items.forEach((it, i) => {
      it.addEventListener('click', () => this.pick(i), sig);
      if (this.opts.follow) {
        it.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.setActive(i); }, sig);
        it.addEventListener('focus', () => this.setActive(i), sig);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const p = this.local(e.clientX, e.clientY);
      Object.assign(this.s.mouse, { x: p.x, y: p.y, on: true });
      this.loop();
    }, sig);
    el.addEventListener('pointerleave', () => { this.s.mouse.on = false; this.loop(); }, sig);
    el.addEventListener('pointerdown', (e) => { const p = this.local(e.clientX, e.clientY); this.ripple(p.x, p.y, 0.8); }, sig);
    this.io.disconnect(); this.io.observe(el);
    this.ro.disconnect(); this.ro.observe(el);
    this.s.ready = false;
    this.mark();
    this.measure();
  }
  destroy() {
    if (this.ac) this.ac.abort();
    this.io.disconnect(); this.ro.disconnect();
    cancelAnimationFrame(this.s.raf); this.s.raf = 0;
    // The canvas belongs to React and may be reused by the next bar (fast refresh), so its
    // context is left alive; it goes away with the element.
  }
  local(cx, cy) { const r = this.el.getBoundingClientRect(); return { x: cx - r.left + LQ_PAD, y: cy - r.top + LQ_PAD }; }
  mark() {
    this.items.forEach((it, i) => {
      it.classList.toggle('is-active', i === this.current);
      if (!this.opts.mark) return;   // the footer's drop only follows the pointer; it marks no current page
      if (i === this.current) it.setAttribute('aria-current', 'true'); else it.removeAttribute('aria-current');
    });
  }
  setActive(i) {
    if (i < 0 || i >= this.items.length || i === this.current) return;
    this.current = i;
    this.mark();
    this.measure();
  }
  // called every frame with the section in view; a tap wins for a moment while the page scrolls to it
  sync(name) {
    if (performance.now() < this.lockUntil) return;
    const i = this.items.findIndex((it) => it.dataset.navLink === name);
    if (i >= 0) this.setActive(i);
  }
  pick(i) {
    const it = this.items[i], kind = it.dataset.fx || 'pop';
    const ico = $('.lq-ico', it);
    if (ico && !reduceMotion) { ico.removeAttribute('data-play'); void ico.offsetWidth; ico.dataset.play = kind; }
    if (this.opts.mark) this.lockUntil = performance.now() + 1400;
    this.setActive(i);
    if (ico) {
      const b = ico.getBoundingClientRect(), c = this.local(b.left + b.width / 2, b.top + b.height / 2);
      if (kind === 'drop') setTimeout(() => this.ripple(c.x, this.s.t.cy, 1.4), 430);
      if (kind === 'plane') this.ripple(c.x, c.y, 0.6);
    }
  }
  ripple(x, y, amp) { if (reduceMotion) return; this.s.rips.push({ x, y, age: 0, amp }); this.loop(); }
  measure() {
    const nav = this.el, it = this.items[this.current];
    if (!nav || !it || !nav.offsetWidth) return;
    const s = this.s, T = s.t;
    s.w = nav.offsetWidth; s.h = nav.offsetHeight;
    T.r = it.offsetHeight / 2;
    T.q = Math.max(0, it.offsetWidth / 2 - T.r);
    T.cy = LQ_PAD + it.offsetTop + it.offsetHeight / 2;
    const nx = LQ_PAD + it.offsetLeft + it.offsetWidth / 2;
    if (!s.ready) { s.a.x = s.b.x = nx; s.a.v = s.b.v = 0; s.q = T.q; s.ready = true; }
    else if (Math.abs(nx - T.x) > 0.5) {
      s.lead = Math.abs(nx - s.a.x) <= Math.abs(nx - s.b.x) ? 0 : 1;
      s.lagFrom = performance.now() + 70; s.moving = true; s.split = false;
    }
    T.x = nx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = s.w + LQ_PAD * 2, Hh = s.h + LQ_PAD * 2;
    const cv = this.canvas;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Hh * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
      cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
    }
    this.loop();
  }
  step(dt, now) {
    const s = this.s, T = s.t;
    s.time += dt;
    s.q += (T.q - s.q) * Math.min(1, dt * 12);
    const bodies = [s.a, s.b];
    let still = true;
    if (reduceMotion) { s.a.x = s.b.x = T.x; s.a.v = s.b.v = 0; s.sy.s = 1; s.sats = []; }
    else {
      bodies.forEach((B, i) => {
        const lead = i === s.lead, k = lead ? 210 : 72, c = lead ? 25 : 13;
        const f = !lead && now < s.lagFrom ? 0.08 : 1;
        B.v += (k * (T.x - B.x) - c * B.v) * dt * f;
        B.x += B.v * dt;
        const lo = LQ_PAD + 4 + s.q + T.r - 3, hi = LQ_PAD + s.w - 4 - s.q - T.r + 3;
        if (B.x < lo || B.x > hi) { s.sy.v -= Math.min(Math.abs(B.v), 900) * 0.0016; B.x = Math.max(lo, Math.min(hi, B.x)); B.v *= -0.25; }
        if (Math.abs(T.x - B.x) > 0.3 || Math.abs(B.v) > 3) still = false;
      });
      const L = bodies[s.lead];
      const syT = 1 - 0.2 * Math.min(Math.abs(L.v) / 1500, 1);
      s.sy.v += (280 * (syT - s.sy.s) - 9 * s.sy.v) * dt;
      s.sy.s += s.sy.v * dt;
      if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02) still = false;
      // a long jump stretches the neck until it breaks into droplets
      const sep = Math.abs(s.a.x - s.b.x);
      const r = T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1));
      if (!s.split && s.moving && sep - 2 * T.q - 2 * r > -6) {
        s.split = true;
        const lo = bodies[1 - s.lead], hi = bodies[s.lead];
        [0.3, 0.5, 0.72].forEach((t, j) => s.sats.push({
          x: lo.x + (hi.x - lo.x) * t + (Math.random() - 0.5) * 6, y: T.cy + (Math.random() - 0.5) * 10,
          vx: (lo.v + hi.v) * 0.45, vy: (Math.random() - 0.5) * 60, r: 5 + Math.random() * 3 - j * 0.5, k: 70 + Math.random() * 90,
        }));
      }
      s.sats = s.sats.filter((d) => {
        d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt; d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.x = Math.max(LQ_PAD + 6 + d.r, Math.min(LQ_PAD + s.w - 6 - d.r, d.x));
        d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y));
        if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26;
        return d.r > 0.6;
      });
      if (s.sats.length) still = false;
    }
    if (s.moving && still) { s.moving = false; s.rips.push({ x: T.x, y: T.cy, age: 0, amp: s.split ? 1.2 : 0.7 }); }
    s.rips.forEach((p) => { p.age += dt; });
    s.rips = s.rips.filter((p) => p.age < 2.4);
    s.mouse.s += ((s.mouse.on ? 1 : 0) - s.mouse.s) * Math.min(1, dt * 7);
  }
  draw() {
    const s = this.s, T = s.t;
    const sep = Math.abs(s.a.x - s.b.x), thin = Math.min(sep / (2 * (s.q + T.r) || 1), 1);
    if (this.glc) {
      const { gl, u } = this.glc;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(u.uRes, s.w + LQ_PAD * 2, s.h + LQ_PAD * 2);
      gl.uniform1f(u.uDpr, dpr); gl.uniform1f(u.uTime, s.time);
      gl.uniform4f(u.uPill, LQ_PAD, LQ_PAD, s.w, s.h);
      const blobs = new Float32Array(24), sy = new Float32Array(6).fill(1);
      const head = s.lead === 0 ? s.a : s.b, tail = s.lead === 0 ? s.b : s.a;
      blobs.set([head.x, T.cy, s.q * (1 - 0.25 * thin), T.r * (1 - 0.12 * thin), tail.x, T.cy, s.q * (1 - 0.8 * thin), T.r * (1 - 0.5 * thin)], 0);
      sy[0] = sy[1] = s.sy.s;
      s.sats.slice(0, 4).forEach((d, i) => blobs.set([d.x, d.y, 0, d.r], 8 + i * 4));
      gl.uniform4fv(u.uBlob, blobs); gl.uniform1fv(u.uSy, sy);
      const rips = new Float32Array(24);
      s.rips.slice(-6).forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4));
      gl.uniform4fv(u.uRip, rips);
      gl.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s);
      // water takes the page's colours: the accent tints it, a dark page makes it glow a little more
      const bg = THEME.c[0], acc = THEME.c[6];
      const lum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
      gl.uniform1f(u.uDark, Math.min(1, Math.max(0, (0.5 - lum) / 0.35)));
      gl.uniform3f(u.uTint, acc[0], acc[1], acc[2]);
      gl.uniform1f(u.uAmb, reduceMotion ? 0 : 1);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      const r = T.r * (1 - 0.3 * thin);
      this.drop.style.width = (sep + 2 * (s.q + r)) + 'px';
      this.drop.style.transform = 'translateX(' + (Math.min(s.a.x, s.b.x) - s.q - r - LQ_PAD) + 'px) scaleY(' + s.sy.s + ')';
    }
  }
  loop() {
    const s = this.s;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      this.step(dt, now);
      this.draw();
      const busy = s.moving || s.rips.length || s.sats.length || s.mouse.s > 0.01;
      const shown = s.visible && document.visibilityState === 'visible' && gate.state !== 'wait' && gate.state !== 'dive';
      // the water keeps gently moving while in view; with reduced motion it only moves on a change
      s.raf = shown && (!reduceMotion || busy) ? requestAnimationFrame(tick) : 0;
    };
    s.raf = requestAnimationFrame(tick);
  }
}
// One bar per nav, keyed by its data-lq name ('nav' in the top bar, 'foot' in the footer).
// LiquidNav adds and removes them as it mounts.
export const lqBars = new Map();
export function wakeLiquid() { for (const b of lqBars.values()) { b.s.ready = false; b.measure(); } }
export function watchLiquid() {
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeLiquid(); });
  if (/Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) && matchMedia('(hover: hover)').matches &&
      window.CSS && CSS.supports && CSS.supports('backdrop-filter', 'url(#a)')) document.documentElement.dataset.refract = 'on';
}

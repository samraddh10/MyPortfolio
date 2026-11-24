/* Formations: each section's shape, built once from the same 1,728 cubes. */
import { N, SP, FLOOR, TAU, mulberry32, gauss, clamp01, smooth, qmul, randQuat } from './math.js';
import { carVoxels } from './car.js';
import { isLand } from './landmask.js';
import { runtime } from '../runtime/state.js';
import { portraitGrid } from '../lib/portrait.js';

// Cube colour roles; actual colours come from the live theme (PAL3D, linear RGB).
export const PAL3D = [new Float32Array(3), new Float32Array(3), new Float32Array(3), new Float32Array(3)];

export function makeFormations(THREE) {
  const C = { graphite: 0, steel: 1, alu: 2, cobalt: 3 };
  const blank = () => ({
    pos: new Float32Array(N * 3), scl: new Float32Array(N), quat: new Float32Array(N * 4),
    role: new Uint8Array(N), order: new Float32Array(N), gq: new Float32Array(4),
    cam: { pos: [0, 1, 17], look: [0, 0, 0] }, yaw: () => 0, pitch: 0, anim: null, time: 0,
  });
  const setCol = (F, i, c) => { F.role[i] = c; };
  const ident = (F, i) => { F.quat[i * 4 + 3] = 1; };
  // Which faces of each cube are on the outside of the shape (bit per face: +x -x +y -y +z -z).
  // Dots are only drawn on those faces, so shapes read as surfaces, not filled volumes.
  const exposeGrid = (F, px, py, pz) => {
    let o = -1;
    for (let i = 0; i < N; i++) if (F.scl[i] > 0) { o = i; break; }
    if (o < 0) return;
    const ox = F.pos[o * 3], oy = F.pos[o * 3 + 1], oz = F.pos[o * 3 + 2];
    const key = (x, y, z) => Math.round((x - ox) / px) + ',' + Math.round((y - oy) / py) + ',' + Math.round((z - oz) / pz);
    const set = new Set();
    for (let i = 0; i < N; i++) if (F.scl[i] > 0) set.add(key(F.pos[i * 3], F.pos[i * 3 + 1], F.pos[i * 3 + 2]));
    F.faces = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!(F.scl[i] > 0)) continue;
      const x = F.pos[i * 3], y = F.pos[i * 3 + 1], z = F.pos[i * 3 + 2];
      F.faces[i] = (set.has(key(x + px, y, z)) ? 0 : 1) | (set.has(key(x - px, y, z)) ? 0 : 2) | (set.has(key(x, y + py, z)) ? 0 : 4) |
        (set.has(key(x, y - py, z)) ? 0 : 8) | (set.has(key(x, y, z + pz)) ? 0 : 16) | (set.has(key(x, y, z - pz)) ? 0 : 32);
    }
  };
  const onlyFace = (F, bit) => { F.faces = new Uint8Array(N).fill(bit); };
  const normOrder = (F) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) { lo = Math.min(lo, F.order[i]); hi = Math.max(hi, F.order[i]); }
    const d = hi - lo || 1;
    for (let i = 0; i < N; i++) F.order[i] = (F.order[i] - lo) / d;
  };

  const builders = {
    // Hero: a portrait drawn by the cubes. Darker = bigger and closer, like halftone in relief.
    portrait() {
      const F = blank(), r = mulberry32(13);
      const g = (runtime.scene && runtime.scene.portrait) || portraitGrid({});
      const COLS = 36, ROWS = 48, P = 0.165;
      for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col, gc = col * 2, gr = row * 2, W = g.cols;
        const v = (g.L[gr * W + gc] + g.L[gr * W + gc + 1] + g.L[(gr + 1) * W + gc] + g.L[(gr + 1) * W + gc + 1]) / 4;
        const ink = 1 - v;
        F.pos[i * 3] = (col - (COLS - 1) / 2) * P + 1.3;
        F.pos[i * 3 + 1] = ((ROWS - 1) / 2 - row) * P + 0.55;
        F.pos[i * 3 + 2] = (ink - 0.5) * 1.15;
        F.scl[i] = ink < 0.14 ? 0 : Math.min(0.158, 0.03 + Math.pow(ink, 0.85) * 0.15);
        ident(F, i);
        setCol(F, i, ink > 0.58 ? C.graphite : ink > 0.32 ? C.steel : C.alu);
        F.order[i] = (row / ROWS) * 0.85 + r() * 0.15;
      }
      normOrder(F);
      F.cam = { pos: [0, 0.4, 18.5], look: [0, 0.3, 0] };
      F.yaw = (t) => Math.sin(t * 0.3) * 0.1 + (runtime.scene ? runtime.scene.mx * 0.4 : 0);
      F.pitch = (t) => (runtime.scene ? -runtime.scene.my * 0.2 : 0);
      F.anim = (j, t, S) => { S.z += Math.sin(t * 1.1 + Math.floor(j / 36) * 0.22) * 0.05; };
      F.isPortrait = true; F.px = 1.3;
      onlyFace(F, 16);
      F.patch = new Float32Array(N); F.dsz = new Float32Array(N);
      for (let i = 0; i < COLS * ROWS; i++) {
        const ink = Math.min(1, (F.scl[i] - 0.03) / 0.15);
        F.patch[i] = P * 1.0; F.dsz[i] = 0.45 + Math.max(0, ink) * 1.55;
      }
      F.wave = 0.012;
      return F;
    },

    // Work intro: a sphere of dot-lined silk with a twisted ribbon through it.
    orb() {
      const F = blank(), r = mulberry32(31);
      const SH = 1360, RU = 46, RV = 8, RAD = 2.7;
      const basis = new THREE.Matrix4(), qt = new THREE.Quaternion(), vE = new THREE.Vector3(), vN = new THREE.Vector3(), vS = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const setQ = (i) => { F.quat[i * 4] = qt.x; F.quat[i * 4 + 1] = qt.y; F.quat[i * 4 + 2] = qt.z; F.quat[i * 4 + 3] = qt.w; };
      const golden = Math.PI * (3 - Math.sqrt(5)), sp = Math.sqrt((4 * Math.PI) / SH) * RAD;
      let i = 0;
      for (let k = 0; k < SH; k++, i++) {
        const y = 1 - ((k + 0.5) / SH) * 2, rr = Math.sqrt(1 - y * y), th = k * golden;
        vN.set(Math.cos(th) * rr, y, Math.sin(th) * rr);
        F.pos[i * 3] = vN.x * RAD; F.pos[i * 3 + 1] = vN.y * RAD; F.pos[i * 3 + 2] = vN.z * RAD;
        vE.crossVectors(up, vN); if (vE.lengthSq() < 1e-6) vE.set(1, 0, 0); vE.normalize(); vS.crossVectors(vE, vN);
        qt.setFromRotationMatrix(basis.makeBasis(vE, vN, vS)); setQ(i);
        F.scl[i] = sp * 0.9;
        setCol(F, i, C.graphite);
        F.order[i] = (1 - y) * 0.5 + r() * 0.3;
      }
      // a twisted ribbon looping through the middle
      const tan = new THREE.Vector3(), wid = new THREE.Vector3(), rad = new THREE.Vector3();
      for (let a = 0; a < RU; a++) for (let b = 0; b < RV; b++, i++) {
        const u = (a / RU) * TAU, v = (b / (RV - 1) - 0.5) * 1.15;
        rad.set(Math.cos(u), 0, Math.sin(u));
        tan.set(-Math.sin(u), 0, Math.cos(u));
        const tw = u * 0.5 + 0.6;
        wid.copy(rad).multiplyScalar(Math.cos(tw)).addScaledVector(up, Math.sin(tw));
        F.pos[i * 3] = rad.x * 1.25 + wid.x * v; F.pos[i * 3 + 1] = wid.y * v * 0.9 + Math.sin(u * 2) * 0.25; F.pos[i * 3 + 2] = rad.z * 1.25 + wid.z * v;
        vN.crossVectors(tan, wid).normalize();
        qt.setFromRotationMatrix(basis.makeBasis(tan, vN, wid)); setQ(i);
        F.scl[i] = 0.17;
        setCol(F, i, C.steel);
        F.order[i] = 0.4 + r() * 0.4;
      }
      for (; i < N; i++) { F.scl[i] = 0; ident(F, i); F.order[i] = r(); }
      normOrder(F);
      onlyFace(F, 4);
      F.wave = 0.3;
      F.cam = { pos: [0, 0.6, 17.5], look: [0, 0, 0] };
      F.yaw = (t) => t * 0.09 + (F.side || 1) * 0.2;
      F.pitch = 0.32;
      return F;
    },

    // Right after the welcome-screen dive: dots scattered all around the viewer, many of them
    // behind the camera, so they stream past and gather into the first shape.
    burst() {
      const F = blank(), r = mulberry32(77);
      for (let i = 0; i < N; i++) {
        const a = r() * TAU, rad = 2.5 + Math.pow(r(), 0.7) * 13;
        F.pos[i * 3] = Math.cos(a) * rad;
        F.pos[i * 3 + 1] = Math.sin(a) * rad * 0.75;
        F.pos[i * 3 + 2] = -6 + r() * 34;
        F.scl[i] = 0.06 + Math.pow(r(), 2.5) * 0.16;
        randQuat(r, F.quat, i * 4);
        setCol(F, i, r() < 0.1 ? C.steel : C.graphite);
        F.order[i] = 1 - F.pos[i * 3 + 2] / 28 + r() * 0.25;
      }
      normOrder(F);
      onlyFace(F, 16);
      F.cam = { pos: [0, 0.4, 18.5], look: [0, 0.3, 0] };
      return F;
    },

    // Fallback: a loose constellation of tumbling bytes.
    field() {
      const F = blank(), r = mulberry32(11);
      const axis = new Float32Array(N * 3), speed = new Float32Array(N), phase = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let dx = gauss(r), dy = gauss(r), dz = gauss(r);
        const l = Math.hypot(dx, dy, dz) || 1;
        const rad = Math.pow(r(), 0.45);
        F.pos[i * 3] = (dx / l) * rad * 5.6 + 1.3;
        F.pos[i * 3 + 1] = (dy / l) * rad * 3.6;
        F.pos[i * 3 + 2] = (dz / l) * rad * 4.2;
        F.scl[i] = 0.05 + Math.pow(r(), 3.2) * 0.3;
        randQuat(r, F.quat, i * 4);
        const t = r();
        setCol(F, i, t < 0.025 ? C.cobalt : t < 0.1 ? C.alu : t < 0.2 ? C.steel : C.graphite);
        let ax = gauss(r), ay = gauss(r), az = gauss(r); const al = Math.hypot(ax, ay, az) || 1;
        axis[i * 3] = ax / al; axis[i * 3 + 1] = ay / al; axis[i * 3 + 2] = az / al;
        speed[i] = (0.15 + r() * 0.5) * (r() < 0.5 ? -1 : 1);
        phase[i] = r() * TAU;
        F.order[i] = rad + r() * 0.35;
      }
      normOrder(F);
      F.cam = { pos: [0, 0.5, 18.5], look: [0, 0, 0] };
      F.yaw = (t) => t * 0.035;
      F.pitch = 0.08;
      const q = new Float32Array(4);
      F.anim = (i, t, S) => {
        const ph = phase[i];
        S.y += Math.sin(t * 0.55 + ph) * 0.14;
        S.x += Math.cos(t * 0.37 + ph) * 0.09;
        const a = t * speed[i], s = Math.sin(a / 2);
        qmul(S.qx, S.qy, S.qz, S.qw, axis[i * 3] * s, axis[i * 3 + 1] * s, axis[i * 3 + 2] * s, Math.cos(a / 2), q, 0);
        S.qx = q[0]; S.qy = q[1]; S.qz = q[2]; S.qw = q[3];
      };
      return F;
    },

    // Socket/1.1: four keep-alive connections, requests streaming along each.
    wire() {
      const F = blank(), r = mulberry32(23);
      const LANES = 4, PER = 3, GAP = 2, XS = 4, CELL = XS * XS;
      const total = N / CELL;                 // 108 slices of 16 cubes
      const lens = Array(LANES * PER).fill(4); // body slices per request
      let body = total - LANES * PER - lens.reduce((a, b) => a + b, 0);
      while (body > 0) { const k = Math.floor(r() * lens.length); if (lens[k] < 12) { lens[k]++; body--; } }
      const laneOf = new Uint8Array(N), xs = new Float32Array(N);
      const laneLen = [], laneSpeed = [0.5, 0.78, 0.38, 0.64], laneY = [];
      let i = 0;
      for (let l = 0; l < LANES; l++) {
        laneY.push((1.5 - l) * 1.42);
        let slice = 0;
        const startI = i;
        for (let p = 0; p < PER; p++) {
          const len = lens[l * PER + p];
          for (let sl = 0; sl <= len; sl++) {
            for (let a = 0; a < XS; a++) for (let b = 0; b < XS; b++) {
              F.pos[i * 3] = slice * SP;
              F.pos[i * 3 + 1] = laneY[l] + (a - (XS - 1) / 2) * SP;
              F.pos[i * 3 + 2] = (b - (XS - 1) / 2) * SP;
              F.scl[i] = 0.235;
              ident(F, i);
              setCol(F, i, sl === 0 ? C.cobalt : C.graphite);
              laneOf[i] = l;
              i++;
            }
            slice++;
          }
          slice += GAP + Math.floor(r() * 2);
        }
        laneLen.push(slice * SP);
        for (let j = startI; j < i; j++) { F.pos[j * 3] -= laneLen[l] / 2; xs[j] = F.pos[j * 3]; F.order[j] = (F.pos[j * 3] / laneLen[l] + 0.5) * 0.8 + r() * 0.2; }
      }
      for (; i < N; i++) { F.scl[i] = 0; ident(F, i); setCol(F, i, C.graphite); }
      normOrder(F);
      exposeGrid(F, SP, SP, SP);
      F.cam = { pos: [0, 1.4, 17], look: [0, 0, 0] };
      F.yaw = () => -0.42 * (F.side || 1);
      F.pitch = 0.08;
      F.anim = (j, t, S) => {
        const l = laneOf[j], L = laneLen[l];
        let x = xs[j] + t * laneSpeed[l];
        x = ((((x + L / 2) % L) + L) % L) - L / 2;
        S.x = x;
        const edge = L / 2 - Math.abs(x);
        S.s *= smooth(clamp01(edge / 1.2));
      };
      return F;
    },

    // Wisp: the Earth in cube tiles, turned by scrolling. Violet trails are a crawler hopping
    // between pages; the ring around it is the index it builds.
    globe() {
      const F = blank(), r = mulberry32(77);
      const ARCS = 8, TRAIL = 13, RAD = 2.45, MAXG = N - ARCS * TRAIL - 150;
      // tiles laid out in rows along the parallels, so coastlines read cleanly
      const layout = (sp) => {
        const pts = [], bands = Math.round(Math.PI / sp);
        for (let b = 0; b < bands; b++) {
          const lat = -90 + ((b + 0.5) * 180) / bands, n = Math.max(1, Math.round((TAU * Math.cos((lat * Math.PI) / 180)) / sp));
          for (let k = 0; k < n; k++) pts.push([lat, -180 + ((k + 0.5 + (b % 2) * 0.5) * 360) / n]);
        }
        return pts;
      };
      let sp = Math.sqrt((4 * Math.PI) / MAXG), pts = layout(sp);
      while (pts.length > MAXG) { sp *= 1.01; pts = layout(sp); }
      const G = pts.length, RING = N - G - ARCS * TRAIL;
      const kind = new Uint8Array(N);
      const dirs = new Float32Array(G * 3), land = new Uint8Array(G), latOf = new Float32Array(G), lonOf = new Float32Array(G);
      for (let k = 0; k < G; k++) {
        const la = (pts[k][0] * Math.PI) / 180, lo = (pts[k][1] * Math.PI) / 180;
        dirs[k * 3] = Math.cos(la) * Math.sin(lo); dirs[k * 3 + 1] = Math.sin(la); dirs[k * 3 + 2] = Math.cos(la) * Math.cos(lo);
        latOf[k] = pts[k][0]; lonOf[k] = pts[k][1];
        land[k] = isLand(latOf[k], lonOf[k]);
      }
      const basis = new THREE.Matrix4(), qt = new THREE.Quaternion(), vE = new THREE.Vector3(), vN = new THREE.Vector3(), vS = new THREE.Vector3();
      // how far inland each tile is: share of land among nearby tiles, used for relief
      const near = Math.cos(0.2);
      for (let k = 0; k < G; k++) {
        let tot = 0, lnd = 0;
        if (land[k]) for (let m = 0; m < G; m++) {
          if (dirs[k * 3] * dirs[m * 3] + dirs[k * 3 + 1] * dirs[m * 3 + 1] + dirs[k * 3 + 2] * dirs[m * 3 + 2] > near) { tot++; lnd += land[m]; }
        }
        const inland = land[k] ? lnd / (tot || 1) : 0;
        const lift = land[k] ? 0.07 + Math.pow(inland, 3) * 0.16 : -0.02;
        const d = [dirs[k * 3], dirs[k * 3 + 1], dirs[k * 3 + 2]];
        F.pos[k * 3] = d[0] * (RAD + lift); F.pos[k * 3 + 1] = d[1] * (RAD + lift); F.pos[k * 3 + 2] = d[2] * (RAD + lift);
        F.scl[k] = (land[k] ? 0.86 : 0.76) * sp * RAD;
        // one face outward, edges along the parallels and meridians
        const lo = (lonOf[k] * Math.PI) / 180;
        vN.set(d[0], d[1], d[2]); vE.set(Math.cos(lo), 0, -Math.sin(lo)); vS.crossVectors(vE, vN);
        qt.setFromRotationMatrix(basis.makeBasis(vE, vN, vS));
        F.quat[k * 4] = qt.x; F.quat[k * 4 + 1] = qt.y; F.quat[k * 4 + 2] = qt.z; F.quat[k * 4 + 3] = qt.w;
        setCol(F, k, land[k] ? (Math.abs(latOf[k]) > 62 ? C.alu : C.graphite) : C.steel);
        F.order[k] = ((lonOf[k] + 180) / 360) * 0.8 + r() * 0.2;
      }
      // crawl arcs between land tiles
      const landIdx = []; for (let k = 0; k < G; k++) if (land[k] && Math.abs(latOf[k]) < 60) landIdx.push(k);
      const arcs = [];
      while (arcs.length < ARCS) {
        const a = landIdx[Math.floor(r() * landIdx.length)], b = landIdx[Math.floor(r() * landIdx.length)];
        const dot = dirs[a * 3] * dirs[b * 3] + dirs[a * 3 + 1] * dirs[b * 3 + 1] + dirs[a * 3 + 2] * dirs[b * 3 + 2];
        const om = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (om < 0.5 || om > 1.9) continue;
        arcs.push({ a: [dirs[a * 3], dirs[a * 3 + 1], dirs[a * 3 + 2]], b: [dirs[b * 3], dirs[b * 3 + 1], dirs[b * 3 + 2]], om, h: 0.07 + om * 0.1, sp: 0.16 + r() * 0.12, ph: r() });
      }
      const arcOf = new Int8Array(N).fill(-1), trailK = new Uint8Array(N);
      let i = G;
      for (let a = 0; a < ARCS; a++) for (let k = 0; k < TRAIL; k++, i++) {
        kind[i] = 1; arcOf[i] = a; trailK[i] = k;
        const A = arcs[a].a;
        F.pos[i * 3] = A[0] * RAD; F.pos[i * 3 + 1] = A[1] * RAD; F.pos[i * 3 + 2] = A[2] * RAD;
        F.scl[i] = 0; ident(F, i); setCol(F, i, C.cobalt); F.order[i] = r();
      }
      // the ring
      const ringAng = new Float32Array(N), ringRad = new Float32Array(N), ringY = new Float32Array(N);
      for (let k = 0; k < RING; k++, i++) {
        kind[i] = 2;
        ringAng[i] = (k / RING) * TAU + r() * 0.03;
        ringRad[i] = 3.55 + gauss(r) * 0.12;
        ringY[i] = gauss(r) * 0.05;
        F.scl[i] = 0.07 + r() * 0.08;
        randQuat(r, F.quat, i * 4);
        const t = r();
        setCol(F, i, t < 0.07 ? C.cobalt : t < 0.55 ? C.alu : C.steel);
        F.pos[i * 3] = Math.cos(ringAng[i]) * ringRad[i]; F.pos[i * 3 + 2] = Math.sin(ringAng[i]) * ringRad[i];
        F.order[i] = r();
      }
      for (; i < N; i++) { F.scl[i] = 0; ident(F, i); }
      normOrder(F);
      F.faces = new Uint8Array(N).fill(63);
      for (let k = 0; k < G; k++) F.faces[k] = 4;
      F.wave = 0.02;
      F.cam = { pos: [0, 0.9, 16.5], look: [0, -0.35, 0] };
      F.yaw = () => 0; F.pitch = 0;
      // Axial tilt (23.4 degrees) and a lean towards the viewer, spun by scroll position.
      // India faces the viewer as the section arrives.
      const tilt = new Float32Array(4); qmul(Math.sin(0.14), 0, 0, Math.cos(0.14), 0, 0, Math.sin(-0.204), Math.cos(-0.204), tilt, 0);
      F.gqFn = (t, out) => {
        const vh = window.innerHeight || 800;
        const spin = (-78 * Math.PI) / 180 + (runtime.scene ? (runtime.scene.scroll - runtime.scene.globeTop) / vh : 0) * 2.4 + Math.sin(t * 0.4) * 0.03;
        qmul(tilt[0], tilt[1], tilt[2], tilt[3], 0, Math.sin(spin / 2), 0, Math.cos(spin / 2), out, 0);
      };
      const rq = new Float32Array(4);
      F.anim = (j, t, S) => {
        const kd = kind[j];
        if (kd === 1) {
          const A0 = arcs[arcOf[j]], u = ((t * A0.sp + A0.ph) % 1.35) - trailK[j] * 0.022;
          if (u < 0 || u > 1) { S.s = 0; return; }
          const so = Math.sin(A0.om), wa = Math.sin((1 - u) * A0.om) / so, wb = Math.sin(u * A0.om) / so;
          const rad = RAD * (1 + A0.h * Math.sin(Math.PI * u));
          S.x = (A0.a[0] * wa + A0.b[0] * wb) * rad; S.y = (A0.a[1] * wa + A0.b[1] * wb) * rad; S.z = (A0.a[2] * wa + A0.b[2] * wb) * rad;
          S.s = 0.03 + 0.12 * (1 - trailK[j] / TRAIL);
        } else if (kd === 2) {
          const a = ringAng[j] + t * 0.09, rr = ringRad[j];
          // ring plane leans 0.32 rad from the equator
          const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = ringY[j];
          S.x = x; S.y = y * Math.cos(0.32) - z * Math.sin(0.32); S.z = y * Math.sin(0.32) + z * Math.cos(0.32);
          const h = (t * 0.6 + j) / 2;
          qmul(S.qx, S.qy, S.qz, S.qw, Math.sin(h) * 0.577, Math.sin(h) * 0.577, Math.sin(h) * 0.577, Math.cos(h), rq, 0);
          S.qx = rq[0]; S.qy = rq[1]; S.qz = rq[2]; S.qw = rq[3];
        }
      };
      return F;
    },

    // Wisp (alternative): an inverted index as a skyline of posting lists, longest at the back.
    index() {
      const F = blank(), r = mulberry32(37);
      const COLS = 18, ROWS = 16, CELLS = COLS * ROWS, PITCH = 0.3;
      const HI = [{ c: 6, rw: 14, h: 15 }, { c: 11, rw: 15, h: 5 }]; // scope (87 pages), closur (25)
      const target = N - HI.reduce((a, b) => a + b.h, 0), M = CELLS - HI.length;
      const zipf = (Cz) => Array.from({ length: M }, (_, k) => Math.min(18, Math.max(1, Math.round(Cz / Math.pow(k + 1, 0.62)))));
      let lo = 1, hi = 400;
      for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (zipf(mid).reduce((a, b) => a + b, 0) < target) lo = mid; else hi = mid; }
      const heights = zipf(lo);
      let sum = heights.reduce((a, b) => a + b, 0);
      while (sum < target) { const k = Math.floor(r() * M); if (heights[k] < 18) { heights[k]++; sum++; } }
      while (sum > target) { const k = M - 1 - Math.floor(r() * M * 0.5); if (heights[k] > 1) { heights[k]--; sum--; } }
      heights.sort((a, b) => b - a);
      // cells ordered from the back-left corner towards the front-right, with a little jitter
      const cells = [];
      for (let rw = 0; rw < ROWS; rw++) for (let c = 0; c < COLS; c++) {
        if (HI.some((h) => h.c === c && h.rw === rw)) continue;
        cells.push({ c, rw, k: (ROWS - 1 - rw) * 1.1 + (COLS - 1 - c) * 0.7 + r() * 3.5 });
      }
      cells.sort((a, b) => b.k - a.k);
      const plan = cells.map((cell, k) => ({ c: cell.c, rw: cell.rw, h: heights[k], hot: false }))
        .concat(HI.map((h) => ({ c: h.c, rw: h.rw, h: h.h, hot: true })));
      const hot = new Uint8Array(N);
      let i = 0;
      for (const col of plan) {
        for (let k = 0; k < col.h; k++) {
          F.pos[i * 3] = (col.c - (COLS - 1) / 2) * PITCH;
          F.pos[i * 3 + 1] = FLOOR + 0.13 + k * SP;
          F.pos[i * 3 + 2] = (col.rw - (ROWS - 1) / 2) * PITCH;
          F.scl[i] = 0.255;
          ident(F, i);
          setCol(F, i, col.hot ? C.cobalt : k === col.h - 1 && col.h > 7 ? C.steel : C.graphite);
          hot[i] = col.hot ? 1 : 0;
          F.order[i] = (k / 22) * 0.75 + r() * 0.25;
          i++;
        }
      }
      for (; i < N; i++) { F.scl[i] = 0; ident(F, i); }
      normOrder(F);
      exposeGrid(F, 0.3, SP, 0.3);
      F.cam = { pos: [0, 5.6, 16.5], look: [0, -0.6, 0] };
      F.yaw = (t) => -0.62 + Math.sin(t * 0.12) * 0.08;
      F.anim = (j, t, S) => { if (hot[j]) S.s *= 1 + Math.sin(t * 2.6) * 0.06; };
      return F;
    },

    // Pit Wall: an F1 car in red and white, wheels turning, kerbs streaming past.
    car() {
      const F = blank(), r = mulberry32(61);
      const KERBS = 80;
      let vox = null, pitch = 0.1;
      for (const p of [0.1, 0.105, 0.11, 0.115, 0.12, 0.125, 0.13, 0.14]) { vox = carVoxels(p); pitch = p; if (vox.length <= N - KERBS) break; }
      const K = 1.2, base = FLOOR + 0.03, cs = pitch * K * 0.92, W = vox.wheels;
      const wheelOf = new Int8Array(N).fill(-1), rel = new Float32Array(N * 2), isKerb = new Uint8Array(N), kerbX = new Float32Array(N);
      let i = 0;
      for (const o of vox) {
        if (i >= N) break;
        F.pos[i * 3] = o.x * K; F.pos[i * 3 + 1] = base + o.y * K; F.pos[i * 3 + 2] = o.z * K;
        F.scl[i] = cs;
        ident(F, i);
        setCol(F, i, o.role);
        if (o.wheel >= 0) {
          const ax = W[o.wheel].x * K, ay = base + W[o.wheel].r * K;
          wheelOf[i] = o.wheel;
          rel[i * 2] = Math.hypot(F.pos[i * 3] - ax, F.pos[i * 3 + 1] - ay);
          rel[i * 2 + 1] = Math.atan2(F.pos[i * 3 + 1] - ay, F.pos[i * 3] - ax);
        }
        F.order[i] = 0.3 + o.y * 0.5 + r() * 0.2;
        i++;
      }
      // red and white kerbs on both sides
      const L = 10.5, T = 0.35, per = Math.min(Math.floor((N - i) / 2), Math.floor(L / T));
      for (let side = -1; side <= 1; side += 2) for (let k = 0; k < per; k++, i++) {
        F.pos[i * 3] = -L / 2 + (k + 0.5) * T; F.pos[i * 3 + 1] = FLOOR + 0.1; F.pos[i * 3 + 2] = side * 1.75;
        F.scl[i] = 0.3;
        ident(F, i);
        setCol(F, i, Math.floor(k / 2) % 2 ? C.cobalt : C.graphite);
        isKerb[i] = 1; kerbX[i] = F.pos[i * 3];
        F.order[i] = r() * 0.3;
      }
      for (; i < N; i++) { F.scl[i] = 0; ident(F, i); F.pos[i * 3 + 1] = FLOOR; F.order[i] = r(); }
      normOrder(F);
      exposeGrid(F, pitch * K, pitch * K, pitch * K);
      for (let k = 0; k < N; k++) if (isKerb[k]) F.faces[k] = 63;
      F.dsz = new Float32Array(N).fill(1.35);
      const SPEED = 4.2;
      F.cam = { pos: [0, 3.3, 15], look: [0, -1.75, 0] };
      F.yaw = (t) => (-0.62 + Math.sin(t * 0.16) * 0.13) * (F.side || 1);
      F.pitch = 0;
      F.anim = (j, t, S) => {
        if (isKerb[j]) {
          let x = kerbX[j] - t * SPEED;
          x = ((((x + L / 2) % L) + L) % L) - L / 2;
          S.x = x;
          S.s *= smooth(clamp01((L / 2 - Math.abs(x)) / 1.6));
          return;
        }
        const w = wheelOf[j];
        if (w >= 0) {
          const R0 = W[w].r * K, ax = W[w].x * K, ay = base + R0, th = -t * SPEED / R0, a = rel[j * 2 + 1] + th;
          S.x = ax + rel[j * 2] * Math.cos(a);
          S.y = ay + rel[j * 2] * Math.sin(a);
          S.qx = 0; S.qy = 0; S.qz = Math.sin(th / 2); S.qw = Math.cos(th / 2);
        } else {
          S.y += Math.sin(t * 2.3) * 0.012;
        }
      };
      return F;
    },

    // Pit Wall (alternative): 434 clauses in embedding space; a query and its five nearest.
    embed() {
      const F = blank(), r = mulberry32(53);
      const VIS = 434, K = 9;
      const centers = [], sig = [];
      for (let k = 0; k < K; k++) {
        centers.push([gauss(r) * 1.55, gauss(r) * 0.95, gauss(r) * 1.25]);
        sig.push(0.28 + r() * 0.24);
      }
      for (let i = 0; i < N; i++) {
        const k = Math.floor(r() * K), c = centers[k];
        const vis = i < VIS;
        const s = vis ? sig[k] : 0.15;
        F.pos[i * 3] = c[0] + gauss(r) * s;
        F.pos[i * 3 + 1] = c[1] + gauss(r) * s;
        F.pos[i * 3 + 2] = c[2] + gauss(r) * s;
        F.scl[i] = vis ? 0.16 + r() * 0.04 : 0;
        randQuat(r, F.quat, i * 4);
        if (vis) { const q = F.quat; q[i * 4] *= 0.15; q[i * 4 + 1] *= 0.15; q[i * 4 + 2] *= 0.15; const l = Math.hypot(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]); for (let m = 0; m < 4; m++) q[i * 4 + m] /= l; }
        setCol(F, i, r() < 0.18 ? C.steel : C.graphite);
      }
      // query: the visible point nearest a spot at the edge of a cluster
      const spot = [centers[2][0] + 0.45, centers[2][1] + 0.35, centers[2][2] + 0.5];
      const d2 = (i, p) => (F.pos[i * 3] - p[0]) ** 2 + (F.pos[i * 3 + 1] - p[1]) ** 2 + (F.pos[i * 3 + 2] - p[2]) ** 2;
      let q = 0;
      for (let i = 1; i < VIS; i++) if (d2(i, spot) < d2(q, spot)) q = i;
      const qp = [F.pos[q * 3], F.pos[q * 3 + 1], F.pos[q * 3 + 2]];
      const near = Array.from({ length: VIS }, (_, i) => i).filter((i) => i !== q).sort((a, b) => d2(a, qp) - d2(b, qp)).slice(0, 5);
      F.scl[q] = 0.34; setCol(F, q, C.cobalt);
      near.forEach((i) => { F.scl[i] = 0.25; setCol(F, i, C.cobalt); });
      for (let i = 0; i < N; i++) F.order[i] = Math.sqrt(d2(i, qp)) + r() * 0.8;
      normOrder(F);
      F.query = q; F.near = near;
      F.cam = { pos: [0, 0.9, 15.5], look: [0, 0, 0] };
      F.yaw = (t) => t * 0.07;
      F.pitch = 0.12;
      F.anim = (j, t, S) => { if (j === q) S.s *= 1 + Math.sin(t * 3) * 0.1; };
      return F;
    },

    // Skills: one plate per row of the list.
    layers(plates = 6) {
      const F = blank(), r = mulberry32(71);
      const P = Math.max(1, Math.min(12, plates));
      const per = Math.floor(N / P);
      const thick = Math.ceil(per / 144);
      const pitch = thick * SP + 0.5;
      const H = P * pitch - 0.5;
      const plateOf = new Int8Array(N).fill(-1);
      let i = 0;
      for (let p = 0; p < P; p++) {
        for (let j = 0; j < per; j++, i++) {
          const layer = Math.floor(j / 144), w = j % 144, gx = w % 12, gz = Math.floor(w / 12);
          F.pos[i * 3] = (gx - 5.5) * SP;
          F.pos[i * 3 + 1] = H / 2 - p * pitch - layer * SP;
          F.pos[i * 3 + 2] = (gz - 5.5) * SP;
          F.scl[i] = 0.25;
          ident(F, i);
          setCol(F, i, C.graphite);
          plateOf[i] = p;
          F.order[i] = (p / P) * 0.8 + r() * 0.2;
        }
      }
      for (; i < N; i++) { F.scl[i] = 0; ident(F, i); F.order[i] = r(); }
      normOrder(F);
      exposeGrid(F, SP, SP, SP);
      F.cam = { pos: [0, 4.4, 17.5], look: [0, -0.2, 0] };
      F.yaw = (t) => 0.62 + Math.sin(t * 0.14) * 0.1;
      F.pitch = 0;
      F.plateOf = plateOf;
      F.anim = (j, t, S) => {
        const p = plateOf[j];
        if (p < 0) return;
        const lift = runtime.scene ? runtime.scene.plateLift[p] || 0 : 0;
        S.x += lift * 1.1;
        S.y += Math.sin(t * 0.8 + p * 0.9) * 0.04 + lift * 0.12;
        if (lift > 0.001) { const a = PAL3D[3]; S.r += (a[0] - S.r) * lift; S.g += (a[1] - S.g) * lift; S.b += (a[2] - S.b) * lift; }
      };
      return F;
    },

    // About: a runway of tiles rippling away from the viewer.
    floor() {
      const F = blank(), r = mulberry32(89);
      const COLS = 20, ROWS = Math.floor(N / COLS);
      const dist = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        if (i >= COLS * ROWS) { F.scl[i] = 0; ident(F, i); F.pos[i * 3 + 1] = FLOOR; continue; }
        const c = i % COLS, rw = Math.floor(i / COLS);
        const x = (c - (COLS - 1) / 2) * SP + 2.2, z = (rw - (ROWS - 1) / 2) * SP - 8.5;
        F.pos[i * 3] = x; F.pos[i * 3 + 1] = FLOOR + 0.11; F.pos[i * 3 + 2] = z;
        F.scl[i] = 0.205;
        ident(F, i);
        setCol(F, i, r() < 0.05 ? C.steel : C.graphite);
        dist[i] = Math.hypot(x, z - 4);
        F.order[i] = -z + r() * 1.5;
      }
      normOrder(F);
      onlyFace(F, 4);
      F.cam = { pos: [0, 4.6, 15.5], look: [0, -1.8, -3] };
      F.yaw = () => 0.32;
      F.anim = (j, t, S) => {
        const d = dist[j];
        S.y += Math.sin(d * 1.3 - t * 1.6) * 0.2 * Math.exp(-d * 0.05);
      };
      return F;
    },

    // Contact: every byte assembled into one cube.
    cube() {
      const F = blank(), r = mulberry32(97);
      for (let i = 0; i < N; i++) {
        const x = i % 12, y = Math.floor(i / 12) % 12, z = Math.floor(i / 144);
        F.pos[i * 3] = (x - 5.5) * SP; F.pos[i * 3 + 1] = (y - 5.5) * SP + 0.1; F.pos[i * 3 + 2] = (z - 5.5) * SP;
        F.scl[i] = 0.25;
        ident(F, i);
        const corner = (x === 0 || x === 11) && (y === 0 || y === 11) && (z === 0 || z === 11);
        setCol(F, i, corner ? C.cobalt : C.graphite);
        F.order[i] = (y / 11) * 0.75 + r() * 0.25;
      }
      normOrder(F);
      exposeGrid(F, SP, SP, SP);
      F.cam = { pos: [0, 1.8, 15.5], look: [0, 0, 0] };
      F.yaw = (t) => 0.7 + t * 0.1;
      F.pitch = 0.42;
      F.anim = (j, t, S) => {
        const e = runtime.scene ? runtime.scene.explode : 0;
        if (e > 0.001) { const k = 1 + e * 0.5; S.x *= k; S.y = (S.y - 0.1) * k + 0.1; S.z *= k; }
      };
      return F;
    },
  };
  return builders;
}

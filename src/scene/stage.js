/* The Three.js stage: a fixed canvas behind the page where the cubes rebuild into each
   section's shape as it scrolls in. Three.js is imported dynamically so the page still
   works if WebGL is unavailable. */
import { N, FLOOR, TAU, mulberry32, gauss, clamp01, easeInOut, qmul, yawPitch } from './math.js';
import { PAL3D, makeFormations } from './formations.js';
import { runtime, gate, layoutCache, reduceMotion, DIVE_MS } from '../runtime/state.js';
import { THEME } from '../runtime/theme.js';
import { finishGate } from '../runtime/gate.js';
import { portraitGrid } from '../lib/portrait.js';

export async function initScene() {
  const canvas = document.getElementById('stage');
  let THREE, RoundedBoxGeometry, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) {
    console.warn('3D scene unavailable:', e);
    return null;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL unavailable:', e);
    return null;
  }
  const small = Math.min(innerWidth, innerHeight) < 700;
  // Quality tiers: 2 = sharp with full shadows, 1 = lighter, 0 = no shadows and plain cubes.
  // Software renderers start at 0; slow frames step the tier down while the page runs.
  let soft = false;
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    soft = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '');
  } catch (e) { soft = false; }
  let tier = soft ? 0 : small ? 1 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.25, 1.75][tier]));
  const BG = 0xe2e4e0;
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = tier > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const s3 = new THREE.Scene();
  s3.fog = new THREE.Fog(BG, 18, 36);
  const pmrem = new THREE.PMREMGenerator(renderer);
  s3.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  s3.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 80);
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(-5, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(tier === 2 ? 2048 : 1024, tier === 2 ? 2048 : 1024);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 45 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  s3.add(key);
  s3.add(new THREE.HemisphereLight(0xffffff, 0xc9ccc7, 0.7));

  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uBase: { value: new THREE.Color() }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uRes: { value: new THREE.Vector2(1, 1) }, uSide: { value: 1 }, uTime: { value: 0 }, uFlow: { value: 0 }, uGrain: { value: 0.06 }, uPx: { value: 1 } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `
      uniform vec3 uBase, uA, uB; uniform vec2 uRes; uniform float uSide, uTime, uFlow, uGrain, uPx;
      float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main() {
        vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
        vec2 p = vec2(uv.x * asp, uv.y);
        vec2 ca = vec2((0.5 + 0.3 * uSide) * asp + 0.06 * sin(uTime * 0.07), 0.76 + 0.05 * cos(uTime * 0.05));
        vec2 cb = vec2((0.5 - 0.36 * uSide) * asp + 0.05 * cos(uTime * 0.06), 0.08);
        float a = 1.0 - smoothstep(0.0, 1.0, distance(p, ca));
        float b = 1.0 - smoothstep(0.0, 1.1, distance(p, cb));
        vec3 col = mix(uBase, uA, a * a * 0.95);
        col = mix(col, uB, b * b * 0.85);
        // slow plasma: overlapping sine waves drifting through the page's own two glow colours
        vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y) * 1.5;
        float k = 4.88;
        float v = sin(q.x * k + uFlow) + sin(q.y * k * 0.8 - uFlow * 0.7)
          + sin((q.x + q.y) * k * 0.6 + uFlow * 0.5) + sin(length(q) * k * 1.2 - uFlow);
        float w = 0.5 + 0.5 * sin(v + 7.0);
        col = mix(col, uA, smoothstep(0.5, 1.0, w) * 0.5);
        col = mix(col, uB, smoothstep(0.5, 0.0, w) * 0.42);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        // film grain in display space, one speck per CSS pixel so it stays fine on sharp screens
        vec2 cell = floor(gl_FragCoord.xy / uPx);
        float n = hash(cell) + hash(cell + vec2(57.31, 113.7)) - 1.0;
        gl_FragColor.rgb += n * uGrain;
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false; bgQuad.renderOrder = -10;
  s3.add(bgQuad);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x1b1e21, opacity: 0.15 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR;
  ground.receiveShadow = true;
  s3.add(ground);

  const tmpC = new THREE.Color();
  const roundGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.16), boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const geoFor = (dots) => (dots || tier === 0 ? boxGeo : roundGeo);
  const startDots = !(runtime.content.settings && runtime.content.settings.particles === 'cubes');
  const geo = geoFor(startDots);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.06 });
  // In dot mode the cubes only cast the soft ground shadow; they draw nothing themselves.
  const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, startDots ? shadowOnly : mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  s3.add(mesh);

  // Dots: every cube position draws a neat G x G grid of tiny dots on each of its outer faces.
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const iQuat = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
  const iScale = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const iVisA = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const iVisB = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const iMisc = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const instAttrs = [iPos, iQuat, iScale, iCol, iVisA, iVisB, iMisc];
  instAttrs.forEach((x) => x.setUsage(THREE.DynamicDrawUsage));
  const makeDotGeo = (Gs) => {
    const g = new THREE.InstancedBufferGeometry(), n = 6 * Gs * Gs, sr = mulberry32(3 + Gs);
    const face = new Float32Array(n), uv = new Float32Array(n * 2), seed = new Float32Array(n), pos = new Float32Array(n * 3);
    let k = 0;
    for (let f = 0; f < 6; f++) for (let a = 0; a < Gs; a++) for (let b = 0; b < Gs; b++, k++) {
      face[k] = f; uv[k * 2] = (a + 0.5) / Gs - 0.5; uv[k * 2 + 1] = (b + 0.5) / Gs - 0.5; seed[k] = sr();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aFace', new THREE.BufferAttribute(face, 1));
    g.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    ['iPos', 'iQuat', 'iScale', 'iCol', 'iVisA', 'iVisB', 'iMisc'].forEach((nm, j) => g.setAttribute(nm, instAttrs[j]));
    g.instanceCount = N;
    return g;
  };
  const dotGeos = [makeDotGeo(2), makeDotGeo(3), makeDotGeo(4)];
  const lightDir = new THREE.Vector3(-5, 14, 9).normalize().add(new THREE.Vector3(0, 0, 0.6)).normalize();
  const grainMat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 0.021 }, uProj: { value: 800 }, uLight: { value: lightDir }, uTime: { value: 0 },
      uRim: { value: new THREE.Color(0x2944d1) },
      uFogColor: { value: new THREE.Color(BG) }, uFogNear: { value: 18 }, uFogFar: { value: 36 },
    },
    vertexShader: `
      attribute float aFace; attribute vec2 aUV; attribute float seed;
      attribute vec3 iPos; attribute vec4 iQuat; attribute float iScale; attribute vec3 iCol;
      attribute vec3 iVisA; attribute vec3 iVisB; attribute vec3 iMisc;
      uniform float uSize, uProj, uFogNear, uFogFar, uTime; uniform vec3 uLight, uRim;
      varying vec3 vCol; varying float vFog;
      vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
      void main() {
        float vis = aFace < 0.5 ? iVisA.x : aFace < 1.5 ? iVisA.y : aFace < 2.5 ? iVisA.z : aFace < 3.5 ? iVisB.x : aFace < 4.5 ? iVisB.y : iVisB.z;
        if (iScale < 0.0008 || vis < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        float ax = floor(aFace * 0.5 + 0.01), sg = mod(aFace, 2.0) < 0.5 ? 1.0 : -1.0;
        vec3 n = ax < 0.5 ? vec3(sg, 0.0, 0.0) : ax < 1.5 ? vec3(0.0, sg, 0.0) : vec3(0.0, 0.0, sg);
        vec3 t1 = ax < 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 t2 = ax < 1.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
        vec3 lp = n * 0.5 + t1 * aUV.x + t2 * aUV.y;
        vec3 wn = qrot(iQuat, n);
        vec3 wp = iPos + qrot(iQuat, lp * iScale);
        // silky ripple along the surface
        float w = sin(dot(wp, vec3(0.9, 0.55, 0.35)) * 1.6 + uTime * 1.1) * sin(dot(wp, vec3(-0.35, 0.8, 0.5)) * 1.25 - uTime * 0.7);
        wp += wn * w * iMisc.y;
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        vec3 vd = normalize(cameraPosition - wp);
        float rim = pow(1.0 - abs(dot(wn, vd)), 2.2);
        float lam = max(dot(wn, uLight), 0.0);
        gl_PointSize = clamp(uSize * iMisc.x * (0.85 + 0.3 * seed) * (1.0 + rim * 0.9) * min(vis * 1.4, 1.0) * uProj / -mv.z, 1.0, 9.0);
        vec3 col = iCol * (0.7 + 0.42 * lam);
        vCol = mix(col, uRim, rim * 0.72);
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
      }`,
    fragmentShader: `
      uniform vec3 uFogColor; varying vec3 vCol; varying float vFog;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(mix(vCol, uFogColor, vFog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const grainGeo = dotGeos[tier];
  const grain = new THREE.Points(grainGeo, grainMat);
  grain.frustumCulled = false;
  grain.visible = startDots;
  s3.add(grain);

  // A faint halo of loose dust drifting around whatever shape is on screen.
  const DUST = 2600;
  const dustGeo = new THREE.BufferGeometry();
  {
    const dr = mulberry32(21), dir = new Float32Array(DUST * 3), misc = new Float32Array(DUST * 3);
    for (let k = 0; k < DUST; k++) {
      let x = gauss(dr), y = gauss(dr) * 0.75, z = gauss(dr); const l = Math.hypot(x, y, z) || 1;
      dir[k * 3] = x / l; dir[k * 3 + 1] = y / l; dir[k * 3 + 2] = z / l;
      misc[k * 3] = 3.3 + Math.pow(dr(), 1.6) * 4.5; misc[k * 3 + 1] = (0.03 + dr() * 0.07) * (dr() < 0.5 ? -1 : 1); misc[k * 3 + 2] = dr();
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dir, 3));
    dustGeo.setAttribute('aMisc', new THREE.BufferAttribute(misc, 3));
  }
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: grainMat.uniforms.uTime, uProj: grainMat.uniforms.uProj, uCenter: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uFogColor: grainMat.uniforms.uFogColor },
    vertexShader: `
      attribute vec3 aMisc; uniform float uTime, uProj; uniform vec3 uCenter; varying float vA;
      void main() {
        float a = uTime * aMisc.y, c = cos(a), s = sin(a);
        vec3 d = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
        vec3 wp = uCenter + d * aMisc.x + vec3(0.0, sin(uTime * 0.3 + aMisc.z * 6.28) * 0.15, 0.0);
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(0.018 * (0.6 + aMisc.z) * uProj / -mv.z, 1.0, 7.0);
        vA = 0.25 + 0.45 * aMisc.z;
      }`,
    fragmentShader: `
      uniform vec3 uCol, uFogColor; varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(mix(uFogColor, uCol, vA), 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.visible = startDots;
  s3.add(dust);
  const setGrainProj = () => {
    const db = renderer.getDrawingBufferSize(new THREE.Vector2()), h = db.y;
    bgMat.uniforms.uRes.value.copy(db);
    bgMat.uniforms.uPx.value = Math.max(1, Math.round(renderer.getPixelRatio()));
    grainMat.uniforms.uProj.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
  };

  // Query-to-neighbour lines for the embedding scene
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 2 * 3), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2944d1, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  s3.add(lines);

  const builders = makeFormations(THREE);
  // About sits on the left of the page, so the portrait turns to face the text: the same dots, mirrored
  builders.mirror = () => {
    const F = builders.portrait();
    for (let i = 0; i < N; i++) F.pos[i * 3] = -F.pos[i * 3];
    F.px = -1.3;
    return F;
  };
  const cache = new Map();
  const getF = (name, plates) => {
    const key = name === 'layers' ? 'layers:' + plates : name;
    if (!cache.has(key)) { const F = (builders[name] || builders.field)(plates); F.name = builders[name] ? name : 'field'; cache.set(key, F); }
    return cache.get(key);
  };

  // per-cube random transit params
  const rnd = mulberry32(5);
  const arc = new Float32Array(N * 3), spinAx = new Float32Array(N * 3), disp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x = gauss(rnd), y = Math.abs(gauss(rnd)) + 0.4, z = gauss(rnd); let l = Math.hypot(x, y, z);
    arc[i * 3] = x / l; arc[i * 3 + 1] = y / l; arc[i * 3 + 2] = z / l;
    x = gauss(rnd); y = gauss(rnd); z = gauss(rnd); l = Math.hypot(x, y, z) || 1;
    spinAx[i * 3] = x / l; spinAx[i * 3 + 1] = y / l; spinAx[i * 3 + 2] = z / l;
  }

  const state = {
    sections: [], plate: -1, plateLift: new Float32Array(12), explode: 0, explodeTarget: 0,
    setSections(list) {
      this.sections = list;
      const g = list.find((x) => x.scene === 'globe');
      this.globeTop = g ? g.top : 0;
    },
    setPlate(k) { this.plate = k; },
    setExplode(v) { this.explodeTarget = v; },
    mx: 0, my: 0, portrait: null, portraitSig: null, scroll: 0, globeTop: 0, dots: startDots,
    setShape(shape) {
      const dots = shape !== 'cubes';
      if (dots === this.dots) return;
      this.dots = dots;
      mesh.geometry = geoFor(dots);
      mesh.material = dots ? shadowOnly : mat;
      mesh.receiveShadow = !dots && tier > 0;
      grain.visible = dots; dust.visible = dots;
    },
    setPortrait(profile) {
      const sig = (profile && profile.portrait) || '';
      if (sig === this.portraitSig) return;
      this.portraitSig = sig;
      this.portrait = portraitGrid(profile || {});
      cache.delete('portrait'); cache.delete('mirror');
    },
  };

  const mouse = { x: 0, y: 0, sx: 0, sy: 0, active: false, last: 0 };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    mouse.active = true; mouse.last = performance.now();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouse.active = false; });

  let wide = true, distScale = 1;
  let viewSide = 1, offBase = 0, vW = innerWidth, vH = innerHeight;
  function applyViewOffset() {
    camera.setViewOffset(vW, vH, -offBase * viewSide, 0, vW, vH);
    camera.updateProjectionMatrix();
  }
  function resize() {
    const W = innerWidth, H = innerHeight;
    vW = W; vH = H;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    wide = W >= 900;
    offBase = wide ? Math.round(W * 0.2) : 0;
    applyViewOffset();
    distScale = wide ? (W / H < 1.35 ? 1.3 : 1.12) : W / H < 0.7 ? 1.75 : 1.35;
    s3.fog.near = 18 * distScale; s3.fog.far = 36 * distScale;
  }
  resize();
  addEventListener('resize', resize);
  setGrainProj();
  addEventListener('resize', setGrainProj);

  function applyTier() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.25, 1.75][tier]));
    const shadows = tier > 0;
    renderer.shadowMap.enabled = shadows;
    key.castShadow = shadows; mesh.castShadow = shadows; mesh.receiveShadow = shadows && !state.dots; ground.visible = shadows;
    grain.geometry = dotGeos[tier]; dust.geometry.setDrawRange(0, tier === 0 ? 900 : tier === 1 ? 1800 : 2600);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    key.shadow.mapSize.set(tier === 2 ? 2048 : 1024, tier === 2 ? 2048 : 1024);
    mesh.geometry = geoFor(state.dots);
    mat.needsUpdate = true; ground.material.needsUpdate = true;
    resize();
    setGrainProj();
  }
  if (tier === 0) applyTier();
  // Frame timing, sampled in windows of 45 frames after a 2.5 s settle. A window's median
  // ignores one-off hitches (coming back to the tab, a GC pause), so only steady slowness
  // lowers the quality, and steady speed raises it again up to the tier this device started on.
  const maxTier = tier, SLOW = 0.034, FAST = 0.021;   // about 29 and 48 frames per second
  const perf = { times: [], start: performance.now(), good: 0, drops: [0, 0, 0] };

  const S = { x: 0, y: 0, z: 0, s: 0, qx: 0, qy: 0, qz: 0, qw: 1, r: 0, g: 0, b: 0 };
  const A = new Float32Array(14), B = new Float32Array(14), tq = new Float32Array(4), gq2 = new Float32Array(4);

  function evalF(F, i, out) {
    S.x = F.pos[i * 3]; S.y = F.pos[i * 3 + 1]; S.z = F.pos[i * 3 + 2]; S.s = F.scl[i];
    S.qx = F.quat[i * 4]; S.qy = F.quat[i * 4 + 1]; S.qz = F.quat[i * 4 + 2]; S.qw = F.quat[i * 4 + 3];
    const pc = PAL3D[F.role[i]];
    S.r = pc[0]; S.g = pc[1]; S.b = pc[2];
    if (F.anim) F.anim(i, F.time, S);
    const gx = F.gq[0], gy = F.gq[1], gz = F.gq[2], gw = F.gq[3];
    // rotate position by group quaternion
    const tx = 2 * (gy * S.z - gz * S.y), ty = 2 * (gz * S.x - gx * S.z), tz = 2 * (gx * S.y - gy * S.x);
    out[0] = S.x + gw * tx + (gy * tz - gz * ty);
    out[1] = S.y + gw * ty + (gz * tx - gx * tz);
    out[2] = S.z + gw * tz + (gx * ty - gy * tx);
    out[3] = S.s;
    qmul(gx, gy, gz, gw, S.qx, S.qy, S.qz, S.qw, out, 4);
    out[8] = S.r; out[9] = S.g; out[10] = S.b;
    out[11] = F.dsz ? F.dsz[i] : 1;
    out[12] = F.patch ? (S.s > 0.0001 ? F.patch[i] : 0) : S.s * 1.12;
    out[13] = F.wave === undefined ? 0.025 : F.wave;
  }

  const P = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3(), lookS = new THREE.Vector3();
  const diveEnd = new THREE.Vector3(0, 0.1, -3.5), diveLook = new THREE.Vector3(0, 0, -14);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(), hit = new THREE.Vector3(), nrm = new THREE.Vector3();
  const mArr = mesh.instanceMatrix.array, cArr = mesh.instanceColor.array, lArr = lineGeo.attributes.position.array;
  let ys = scrollY, introStart = performance.now(), intro = reduceMotion || scrollY > innerHeight * 0.5 ? 1 : 0;
  let last = performance.now(), time = 0, first = true;
  const DMAX = 0.42;
  // Back on the tab: drop the paused stretch from the clock and start a fresh timing window.
  addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    last = performance.now();
    perf.times.length = 0; perf.start = last; perf.good = 0;
  });

  function pickBlend(y) {
    const secs = state.sections, vh = innerHeight;
    if (!secs.length) return { a: getF('field'), b: getF('field'), t: 0, sa: 1, sb: 1 };
    const fOf = (s) => { const F = getF(s.scene, s.plates); F.side = s.side; return F; };
    let a = fOf(secs[0]), b = a, t = 0, sa = secs[0].side, sb = sa;
    const w = vh * 0.42;
    for (let k = 1; k < secs.length; k++) {
      const boundary = secs[k].top - vh * 0.5;
      if (y >= boundary - w) { a = fOf(secs[k - 1]); b = fOf(secs[k]); sa = secs[k - 1].side; sb = secs[k].side; t = clamp01((y - (boundary - w)) / (2 * w)); }
    }
    return { a, b, t, sa, sb };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw);
    last = now;
    // step quality down when frames run slower than about 30 per second; step it back up after
    // three fast windows in a row (about 10 s), unless that tier has already been too slow twice
    if (now - perf.start > 2500 && raw < 0.5) {
      perf.times.push(raw);
      if (perf.times.length >= 45) {
        perf.times.sort((a, b) => a - b);
        const med = perf.times[22];
        if (med > SLOW && tier > 0) { perf.drops[tier]++; tier--; applyTier(); perf.good = 0; }
        else if (med < FAST && tier < maxTier && perf.drops[tier + 1] < 2) {
          if (++perf.good >= 3) { tier++; applyTier(); perf.good = 0; }
        } else perf.good = 0;
        perf.times.length = 0; perf.start = now;
      }
    }
    if (!reduceMotion) time += dt;
    ys += (scrollY - ys) * (1 - Math.exp(-dt * 7));
    if (Math.abs(scrollY - ys) < 0.5) ys = scrollY;
    mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-dt * 4));
    mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-dt * 4));
    state.mx = mouse.sx; state.my = mouse.sy; state.scroll = ys;
    // theme colours for this frame
    tmpC.setRGB(THEME.c[0][0], THEME.c[0][1], THEME.c[0][2], THREE.SRGBColorSpace);
    renderer.setClearColor(tmpC, 1);
    s3.fog.color.copy(tmpC);
    grainMat.uniforms.uFogColor.value.copy(tmpC);
    bgMat.uniforms.uBase.value.copy(tmpC);
    bgMat.uniforms.uA.value.setRGB(THEME.g[0][0], THEME.g[0][1], THEME.g[0][2], THREE.SRGBColorSpace);
    bgMat.uniforms.uB.value.setRGB(THEME.g[1][0], THEME.g[1][1], THEME.g[1][2], THREE.SRGBColorSpace);
    bgMat.uniforms.uSide.value = viewSide; bgMat.uniforms.uTime.value = time; bgMat.uniforms.uGrain.value = THEME.grain;
    bgMat.uniforms.uFlow.value = reduceMotion ? 3.0 : time * 0.86;
    grainMat.uniforms.uTime.value = time;
    grainMat.uniforms.uRim.value.setRGB(THEME.rim[0], THEME.rim[1], THEME.rim[2], THREE.SRGBColorSpace);
    dustMat.uniforms.uCol.value.setRGB(PAL3D[0][0], PAL3D[0][1], PAL3D[0][2]);
    dustMat.uniforms.uCenter.value.copy(lookS);
    grainMat.uniforms.uFogNear.value = s3.fog.near; grainMat.uniforms.uFogFar.value = s3.fog.far;
    ground.material.opacity = THEME.shadow;
    for (let k = 0; k < 4; k++) { tmpC.setRGB(THEME.k[k][0], THEME.k[k][1], THEME.k[k][2], THREE.SRGBColorSpace); PAL3D[k][0] = tmpC.r; PAL3D[k][1] = tmpC.g; PAL3D[k][2] = tmpC.b; }
    lineMat.color.copy(tmpC);
    for (let p = 0; p < 12; p++) state.plateLift[p] += ((p === state.plate ? 1 : 0) - state.plateLift[p]) * (1 - Math.exp(-dt * 8));
    state.explode += (state.explodeTarget - state.explode) * (1 - Math.exp(-dt * 5));

    let { a: FA, b: FB, t, sa, sb } = pickBlend(ys);
    const gated = gate.state === 'wait' || gate.state === 'dive';
    if (gated) {
      const orb = getF('orb');
      FA = FB = orb; t = 0; sa = sb = 0; intro = 1;
    } else if (gate.state === 'done' && !state.dived) {
      // out the other side: cut to the page camera while the dots stream in from all around
      state.dived = true; state.introFrom = 'burst'; introStart = now; intro = reduceMotion ? 1 : 0;
      camera.fov = 32; camera.updateProjectionMatrix(); setGrainProj();
      first = true;
    }
    if (gate.state === 'dive' && performance.now() - gate.start >= DIVE_MS) finishGate();
    // slide the scene to whichever side the section keeps free (eased, so leaving the
    // welcome screen glides from centre instead of jumping)
    const sideT = sa + (sb - sa) * easeInOut(t);
    const side = viewSide + (sideT - viewSide) * (1 - Math.exp(-dt * 4));
    if (Math.abs(side - viewSide) > 0.0005) { viewSide = side; applyViewOffset(); }
    if (t >= 1) { FA = FB; t = 0; }
    if (intro < 1) {
      intro = clamp01((now - introStart) / 2600);
      const s0 = state.sections[0], first = s0 ? getF(s0.scene, s0.plates) : null;
      if (FA === FB && FA === first && t === 0) { FA = getF(state.introFrom || 'cube'); FB = first; t = intro; }
      else intro = 1;
    }
    FA.time = FB.time = time;
    const pitchOf = (F) => (typeof F.pitch === 'function' ? F.pitch(time) : F.pitch);
    const groupOf = (F) => (F.gqFn ? F.gqFn(time, F.gq) : yawPitch(F.yaw(time), pitchOf(F), F.gq));
    groupOf(FA);
    if (FB !== FA) groupOf(FB);
    const et = easeInOut(t);

    // camera
    camPos.set(
      FA.cam.pos[0] + (FB.cam.pos[0] - FA.cam.pos[0]) * et,
      FA.cam.pos[1] + (FB.cam.pos[1] - FA.cam.pos[1]) * et,
      FA.cam.pos[2] + (FB.cam.pos[2] - FA.cam.pos[2]) * et,
    );
    look.set(
      FA.cam.look[0] + (FB.cam.look[0] - FA.cam.look[0]) * et,
      FA.cam.look[1] + (FB.cam.look[1] - FA.cam.look[1]) * et,
      FA.cam.look[2] + (FB.cam.look[2] - FA.cam.look[2]) * et,
    );
    camPos.sub(look).multiplyScalar(distScale).add(look);
    if (!wide) {
      // phones: centre the portrait and lift it into the space above the name
      const hw = (FA.isPortrait ? 1 - et : 0) + (FB.isPortrait ? et : 0);
      const hx = (FA.isPortrait ? FA.px * (1 - et) : 0) + (FB.isPortrait ? FB.px * et : 0);
      camPos.x += hx; look.x += hx; camPos.y -= 4.1 * hw; look.y -= 4.1 * hw;
    }
    if (!reduceMotion) { camPos.x += mouse.sx * 0.7; camPos.y += mouse.sy * 0.4; }
    if (gated) { camPos.y -= 1.1; look.y -= 1.1; }   // lift the sphere clear of the name
    if (first) { lookS.copy(look); camera.position.copy(camPos); first = false; }
    if (gate.state === 'dive' && !reduceMotion) {
      // fly straight through the sphere, speeding up, the lens widening as we go
      const k = Math.min(1, Math.max(0, (performance.now() - gate.start) / DIVE_MS)), e = Math.pow(k, 2.2);
      camPos.lerp(diveEnd, e); look.lerp(diveLook, e);
      camera.position.copy(camPos); lookS.copy(look);
      camera.fov = 32 + 46 * e * e; camera.updateProjectionMatrix(); setGrainProj();
    } else {
      camera.position.lerp(camPos, 1 - Math.exp(-dt * 5));
      lookS.lerp(look, 1 - Math.exp(-dt * 5));
    }
    camera.lookAt(lookS);
    camera.updateMatrixWorld();

    // mouse plane hit
    let hasHit = false;
    if (mouse.active && !reduceMotion) {
      camera.getWorldDirection(nrm).negate();
      plane.setFromNormalAndCoplanarPoint(nrm, lookS);
      ray.setFromCamera({ x: mouse.x, y: mouse.y }, camera);
      hasHit = !!ray.ray.intersectPlane(plane, hit);
    }

    const same = FA === FB;
    const scale1 = 1 - DMAX;
    const grainOn = grain.visible, gP = iPos.array, gQ = iQuat.array, gS = iScale.array, gC = iCol.array, vA = iVisA.array, vB = iVisB.array, gM = iMisc.array;
    for (let i = 0; i < N; i++) {
      evalF(FA, i, A);
      let px, py, pz, s, qx, qy, qz, qw, cr, cg, cb, dz = A[11], pa = A[12], wv = A[13], e = 0;
      if (same || t <= 0) {
        px = A[0]; py = A[1]; pz = A[2]; s = A[3]; qx = A[4]; qy = A[5]; qz = A[6]; qw = A[7]; cr = A[8]; cg = A[9]; cb = A[10];
      } else {
        evalF(FB, i, B);
        e = easeInOut(clamp01((t - FB.order[i] * DMAX) / scale1));
        const ie = 1 - e;
        px = A[0] * ie + B[0] * e; py = A[1] * ie + B[1] * e; pz = A[2] * ie + B[2] * e;
        s = A[3] * ie + B[3] * e;
        dz = A[11] * ie + B[11] * e; pa = A[12] * ie + B[12] * e; wv = A[13] * ie + B[13] * e;
        cr = A[8] * ie + B[8] * e; cg = A[9] * ie + B[9] * e; cb = A[10] * ie + B[10] * e;
        // nlerp orientation (shortest path)
        let bx = B[4], by = B[5], bz = B[6], bw = B[7];
        if (A[4] * bx + A[5] * by + A[6] * bz + A[7] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
        qx = A[4] * ie + bx * e; qy = A[5] * ie + by * e; qz = A[6] * ie + bz * e; qw = A[7] * ie + bw * e;
        const ql = Math.hypot(qx, qy, qz, qw) || 1; qx /= ql; qy /= ql; qz /= ql; qw /= ql;
        if (!reduceMotion && e > 0 && e < 1) {
          const sw = Math.sin(Math.PI * e);
          px += arc[i * 3] * sw * 1.5; py += arc[i * 3 + 1] * sw * 1.5; pz += arc[i * 3 + 2] * sw * 1.5;
          s *= 1 + sw * 0.15; pa *= 1 + sw * 0.15;
          const ang = e * TAU, h = Math.sin(ang / 2);
          qmul(qx, qy, qz, qw, spinAx[i * 3] * h, spinAx[i * 3 + 1] * h, spinAx[i * 3 + 2] * h, Math.cos(ang / 2), tq, 0);
          qx = tq[0]; qy = tq[1]; qz = tq[2]; qw = tq[3];
        }
      }
      // pointer pushes cubes aside
      let tx = 0, ty = 0, tz = 0;
      if (hasHit && s > 0.01) {
        const dx = px - hit.x, dy = py - hit.y, dz = pz - hit.z;
        const dn = dx * nrm.x + dy * nrm.y + dz * nrm.z;
        const qx2 = dx - dn * nrm.x, qy2 = dy - dn * nrm.y, qz2 = dz - dn * nrm.z;
        const d = Math.hypot(qx2, qy2, qz2);
        const RAD = 1.7;
        if (d < RAD) {
          const f = (1 - d / RAD) ** 2 * 1.1, inv = 1 / (d || 1);
          tx = (qx2 * inv * 0.8 + nrm.x * 0.7) * f; ty = (qy2 * inv * 0.8 + nrm.y * 0.7) * f; tz = (qz2 * inv * 0.8 + nrm.z * 0.7) * f;
        }
      }
      const k3 = i * 3, damp = 1 - Math.exp(-dt * 9);
      disp[k3] += (tx - disp[k3]) * damp; disp[k3 + 1] += (ty - disp[k3 + 1]) * damp; disp[k3 + 2] += (tz - disp[k3 + 2]) * damp;
      px += disp[k3]; py += disp[k3 + 1]; pz += disp[k3 + 2];
      if (s < 0.0001) s = 0.0001;

      // compose matrix
      const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
      const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
      const wx = qw * x2, wy = qw * y2, wz = qw * z2;
      const o = i * 16;
      mArr[o] = (1 - (yy + zz)) * s; mArr[o + 1] = (xy + wz) * s; mArr[o + 2] = (xz - wy) * s; mArr[o + 3] = 0;
      mArr[o + 4] = (xy - wz) * s; mArr[o + 5] = (1 - (xx + zz)) * s; mArr[o + 6] = (yz + wx) * s; mArr[o + 7] = 0;
      mArr[o + 8] = (xz + wy) * s; mArr[o + 9] = (yz - wx) * s; mArr[o + 10] = (1 - (xx + yy)) * s; mArr[o + 11] = 0;
      mArr[o + 12] = px; mArr[o + 13] = py; mArr[o + 14] = pz; mArr[o + 15] = 1;
      cArr[k3] = cr; cArr[k3 + 1] = cg; cArr[k3 + 2] = cb;
      if (grainOn) {
        gP[k3] = px; gP[k3 + 1] = py; gP[k3 + 2] = pz;
        gQ[i * 4] = qx; gQ[i * 4 + 1] = qy; gQ[i * 4 + 2] = qz; gQ[i * 4 + 3] = qw;
        gS[i] = pa; gC[k3] = cr; gC[k3 + 1] = cg; gC[k3 + 2] = cb;
        const mA = FA.faces ? FA.faces[i] : 63, mB = same || t <= 0 ? mA : FB.faces ? FB.faces[i] : 63, ie2 = 1 - e;
        vA[k3] = (mA & 1) * ie2 + (mB & 1) * e; vA[k3 + 1] = ((mA >> 1) & 1) * ie2 + ((mB >> 1) & 1) * e; vA[k3 + 2] = ((mA >> 2) & 1) * ie2 + ((mB >> 2) & 1) * e;
        vB[k3] = ((mA >> 3) & 1) * ie2 + ((mB >> 3) & 1) * e; vB[k3 + 1] = ((mA >> 4) & 1) * ie2 + ((mB >> 4) & 1) * e; vB[k3 + 2] = ((mA >> 5) & 1) * ie2 + ((mB >> 5) & 1) * e;
        gM[k3] = dz; gM[k3 + 1] = reduceMotion ? 0 : wv;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    if (grainOn) instAttrs.forEach((x) => { x.needsUpdate = true; });

    // lines for the embedding scene
    const E = FB.query !== undefined ? FB : FA.query !== undefined ? FA : null;
    let lw = 0;
    if (E) {
      lw = E === FB ? (same ? 1 : clamp01((t - 0.55) / 0.4)) : clamp01(1 - t / 0.35);
      const q = E.query;
      for (let n = 0; n < 5; n++) {
        const j = E.near[n];
        lArr[n * 6] = mArr[q * 16 + 12]; lArr[n * 6 + 1] = mArr[q * 16 + 13]; lArr[n * 6 + 2] = mArr[q * 16 + 14];
        lArr[n * 6 + 3] = mArr[j * 16 + 12]; lArr[n * 6 + 4] = mArr[j * 16 + 13]; lArr[n * 6 + 5] = mArr[j * 16 + 14];
      }
      lineGeo.attributes.position.needsUpdate = true;
    }
    lineMat.opacity = lw * 0.8;
    lines.visible = lw > 0.01;

    renderer.render(s3, camera);
    if (!canvas.classList.contains('is-live')) canvas.classList.add('is-live');
  }

  runtime.scene = state;
  state.setPortrait(runtime.content.profile);
  state.setSections(layoutCache.sections);
  requestAnimationFrame(frame);
  return state;
}

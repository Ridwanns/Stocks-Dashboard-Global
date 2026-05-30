// ════════════════════════════════════════════════════════════════════
// WebGL galaxy — three.js particles drifting in a slow rotating sphere.
// Lives in the hero section; the page's React code calls window.startGalaxy
// (canvas, accentHex) once the hero canvas mounts.
// ════════════════════════════════════════════════════════════════════

const THREE = window.THREE;
if (!THREE) {
  window.startGalaxy = () => null;
  console.warn('[Galaxy] Three.js not loaded');
}

const STAR_COUNT = 4500;
const CORE_COUNT = 1200;

// Cache state so a re-mount during HMR / tweak changes can update colors in
// place rather than tearing down the renderer.
const STATE = { renderer: null, scene: null, camera: null, points: [], colors: null, raf: 0, mouse: { x: 0, y: 0 } };

// HSV-ish gradient between two hex colors with optional desaturated outliers
// for a softer falloff at the far edges.
function gradientColors(hexA, hexB, n) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const c = a.clone().lerp(b, t);
    // jitter saturation a touch so the cloud doesn't look like a pure ramp.
    const jit = (Math.random() - 0.5) * 0.12;
    c.r = Math.max(0, Math.min(1, c.r + jit));
    c.g = Math.max(0, Math.min(1, c.g + jit));
    c.b = Math.max(0, Math.min(1, c.b + jit));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  return colors;
}

// Sample points scattered uniformly in a large 3D volume — true starfield,
// not a galaxy disk. Stars are seeded with a fixed RNG so positions are
// stable across re-tints. `cube` is half-extent on each axis.
function sampleStarfield(n, cube = 220, seed = 1) {
  const positions = new Float32Array(n * 3);
  // Mulberry32 — deterministic so palette swaps don't reshuffle stars.
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    positions[i * 3]     = (rng() - 0.5) * 2 * cube;
    positions[i * 3 + 1] = (rng() - 0.5) * 2 * cube;
    // Z biased a bit toward the camera so density doesn't all sit far away.
    positions[i * 3 + 2] = (rng() - 0.5) * 2 * cube - 40;
  }
  return positions;
}

// Build a soft round sprite for the points (additive blend reads better
// with a glow disc than with square pixels).
function makeStarSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,.15)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildScene(canvas, accentA, accentB) {
  // Renderer — alpha so the page's aurora bleeds through.
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.set(0, 0, 110);
  camera.lookAt(0, 0, 0);

  const sprite = makeStarSprite();

  // ── Far layer: dim, very spread, cool color ───────────────────────
  const farPositions = sampleStarfield(STAR_COUNT, 240, 17);
  const farColors = gradientColors(accentB, accentA, STAR_COUNT);
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute('position', new THREE.BufferAttribute(farPositions, 3));
  farGeo.setAttribute('color',    new THREE.BufferAttribute(farColors, 3));
  const farMat = new THREE.PointsMaterial({
    size: 0.9, map: sprite, vertexColors: true,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.7,
  });
  const far = new THREE.Points(farGeo, farMat);
  scene.add(far);

  // ── Mid layer: brighter accent stars ──────────────────────────────
  const midPositions = sampleStarfield(CORE_COUNT, 140, 89);
  const midColors = gradientColors('#ffffff', accentA, CORE_COUNT);
  const midGeo = new THREE.BufferGeometry();
  midGeo.setAttribute('position', new THREE.BufferAttribute(midPositions, 3));
  midGeo.setAttribute('color',    new THREE.BufferAttribute(midColors, 3));
  const midMat = new THREE.PointsMaterial({
    size: 1.4, map: sprite, vertexColors: true,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.95,
  });
  const mid = new THREE.Points(midGeo, midMat);
  scene.add(mid);

  // Ambient backdrop dust — single big sprite to give the impression of a
  // soft nebula behind everything.
  const dustGeo = new THREE.PlaneGeometry(360, 360);
  const dustMat = new THREE.MeshBasicMaterial({
    map: sprite, color: new THREE.Color(accentA),
    transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new THREE.Mesh(dustGeo, dustMat);
  dust.position.z = -80;
  scene.add(dust);

  return { renderer, scene, camera, points: [far, mid], dust };
}

function resize(width, height) {
  if (!STATE.renderer) return;
  STATE.renderer.setSize(width, height, false);
  STATE.camera.aspect = width / height;
  STATE.camera.updateProjectionMatrix();
}

function loop() {
  if (!STATE.renderer) return;
  const t = performance.now() * 0.0001;
  // Very slow drift on the whole starfield — feels like a hovering camera
  // rather than a spinning disk.
  for (const p of STATE.points) {
    p.rotation.y = t * 0.35;
    p.rotation.x = Math.sin(t * 0.4) * 0.04;
  }
  // Mouse parallax — gentle, lerped toward target.
  STATE.camera.position.x += (STATE.mouse.x * 12 - STATE.camera.position.x) * 0.02;
  STATE.camera.position.y += (STATE.mouse.y * 6 - STATE.camera.position.y) * 0.02;
  STATE.camera.lookAt(0, 0, 0);

  STATE.renderer.render(STATE.scene, STATE.camera);
  STATE.raf = requestAnimationFrame(loop);
}

// Public entrypoint — called from Hero's useEffect.
window.startGalaxy = function startGalaxy(canvas, accentA = '#8b5cf6', accentB = '#22d3ee') {
  // Tear down previous if any (palette swap / hot reload).
  if (STATE.renderer) {
    cancelAnimationFrame(STATE.raf);
    STATE.renderer.dispose();
    STATE.points.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
    STATE.renderer = null;
    STATE.points = [];
  }

  const built = buildScene(canvas, accentA, accentB);
  STATE.renderer = built.renderer;
  STATE.scene = built.scene;
  STATE.camera = built.camera;
  STATE.points = built.points;

  const onResize = () => {
    // The starfield canvas is always full-viewport (position:fixed inset:0),
    // so window dims are the reliable source. getBoundingClientRect can read
    // 0×0 on the very first paint right after the bundle swaps the document —
    // which made the field render into 1px and "disappear" until a resize.
    const rect = canvas.getBoundingClientRect();
    const w = window.innerWidth || rect.width || canvas.clientWidth || 1;
    const h = window.innerHeight || rect.height || canvas.clientHeight || 1;
    resize(w, h);
  };
  onResize();
  // Re-measure across paint settling so we never get stuck at 0×0 / 1px.
  requestAnimationFrame(onResize);
  setTimeout(onResize, 120);
  setTimeout(onResize, 600);
  window.addEventListener('resize', onResize);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(onResize);
    try { ro.observe(canvas); } catch (e) {}
  }

  // Track mouse for parallax — normalized to viewport [-1, 1].
  const onMove = (e) => {
    STATE.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    STATE.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener('mousemove', onMove);

  STATE.raf = requestAnimationFrame(loop);

  // Return a stopper so the React component can clean up.
  return () => {
    cancelAnimationFrame(STATE.raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMove);
    if (ro) { try { ro.disconnect(); } catch (e) {} }
    STATE.renderer?.dispose();
    STATE.renderer = null;
  };
};

// ════════════════════════════════════════════════════════════════════
// LOADING GALAXY — a dense rotating spiral shown on the pre-dashboard
// loading screen. Returns { zoomIn(ms,cb), stop() } so the loader can play a
// cinematic dolly through the core to hand off to the dashboard.
// ════════════════════════════════════════════════════════════════════
function buildSpiralGalaxy(accentA, accentB) {
  const N = 14000;          // disk particles
  const ARMS = 4;
  const R = 130;            // disk radius
  const SPIN = 5.2;         // radians of twist from core to rim
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const core = new THREE.Color('#fff4e0');
  const mid  = new THREE.Color(accentA || '#8b5cf6');
  const edge = new THREE.Color(accentB || '#22d3ee');
  let s = 0x9e3779b9 >>> 0;
  const rng = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < N; i++) {
    const t = Math.pow(rng(), 0.62);        // bias toward core
    const r = t * R;
    const arm = Math.floor(rng() * ARMS) / ARMS * Math.PI * 2;
    const spread = (rng() - 0.5) * (0.55 - 0.4 * t) + (rng() - 0.5) * 0.12;
    const ang = arm + t * SPIN + spread;
    const yj = (rng() - 0.5) * (8 * (1 - t) + 1.5);  // thicker bulge at core
    pos[i*3]   = Math.cos(ang) * r;
    pos[i*3+1] = yj;
    pos[i*3+2] = Math.sin(ang) * r;
    const c = (t < 0.45) ? core.clone().lerp(mid, t / 0.45) : mid.clone().lerp(edge, (t - 0.45) / 0.55);
    const tw = 0.8 + rng() * 0.4;
    col[i*3] = c.r * tw; col[i*3+1] = c.g * tw; col[i*3+2] = c.b * tw;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.5, map: makeStarSprite(), vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95,
  });
  return new THREE.Points(geo, mat);
}

// Deterministic RNG factory (Mulberry32) so scenes are stable per seed.
function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Equirectangular texture for a planet sphere. kind: 'earth' | 'moon'.
function makePlanetTexture(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const rng = mulberry(kind === 'earth' ? 7 : 23);
  if (kind === 'earth') {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0b3a63'); g.addColorStop(0.5, '#0e4f86'); g.addColorStop(1, '#0a3357');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
    // continents
    for (let i = 0; i < 26; i++) {
      const x = rng() * 512, y = 30 + rng() * 196, rad = 14 + rng() * 46;
      ctx.fillStyle = rng() > 0.5 ? '#1f7a3d' : '#2f8a44';
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.5) { const rr = rad * (0.6 + rng() * 0.7); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); }
      ctx.closePath(); ctx.fill();
    }
    // ice caps
    ctx.fillStyle = 'rgba(235,245,255,.85)';
    ctx.fillRect(0, 0, 512, 16); ctx.fillRect(0, 240, 512, 16);
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(rng() * 512, rng() * 256, 6 + rng() * 22, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = '#8e8e96'; ctx.fillRect(0, 0, 512, 256);
    // maria (dark seas)
    for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(70,70,80,.5)'; ctx.beginPath(); ctx.arc(rng() * 512, rng() * 256, 18 + rng() * 40, 0, Math.PI * 2); ctx.fill(); }
    // craters
    for (let i = 0; i < 80; i++) {
      const x = rng() * 512, y = rng() * 256, rad = 2 + rng() * 9;
      ctx.fillStyle = 'rgba(60,60,68,.55)'; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,200,210,.35)'; ctx.beginPath(); ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// Sparse deep-background starfield (fills the empty void around the galaxy).
function buildBackgroundStars(n, near, far) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const rng = mulberry(101);
  const a = new THREE.Color('#cfe0ff'), b = new THREE.Color('#a9b6ff');
  for (let i = 0; i < n; i++) {
    // points on a spherical shell so they surround the camera
    const u = rng() * 2 - 1, th = rng() * Math.PI * 2, r = near + rng() * (far - near);
    const sx = Math.sqrt(1 - u * u);
    pos[i*3] = Math.cos(th) * sx * r; pos[i*3+1] = u * r; pos[i*3+2] = Math.sin(th) * sx * r;
    const c = a.clone().lerp(b, rng()); const tw = 0.5 + rng() * 0.5;
    col[i*3] = c.r * tw; col[i*3+1] = c.g * tw; col[i*3+2] = c.b * tw;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.1, map: makeStarSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
}

window.startLoadingGalaxy = function startLoadingGalaxy(canvas, opts) {
  opts = opts || {};
  if (!THREE) return { zoomIn: (ms, cb) => cb && cb(), stop: () => {} };
  const accentA = opts.accentA || '#8b5cf6', accentB = opts.accentB || '#22d3ee';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000);

  // Lights for the planet/moon (the particle systems ignore them).
  scene.add(new THREE.AmbientLight(0x4a5a80, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-1, 0.5, 0.9); scene.add(sun);

  // Deep background stars + the spiral galaxy.
  const bgStars = buildBackgroundStars(2200, 600, 1400); scene.add(bgStars);
  const galaxy = buildSpiralGalaxy(accentA, accentB);
  galaxy.rotation.x = -0.92; scene.add(galaxy);

  // Glowing galaxy core.
  const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color('#fff0d0'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreSprite.scale.set(60, 60, 1); scene.add(coreSprite);

  // ── Earth + Moon system, off to one side ──
  const planetSys = new THREE.Group(); planetSys.position.set(-185, 38, 30); scene.add(planetSys);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 48), new THREE.MeshStandardMaterial({ map: makePlanetTexture('earth'), roughness: 1, metalness: 0 }));
  earth.rotation.z = 0.32; planetSys.add(earth);
  // atmosphere rim glow (back-side larger sphere)
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(33, 36, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(accentB), transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  planetSys.add(atmo);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(accentB), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(110, 110, 1); planetSys.add(glow);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7.5, 28, 28), new THREE.MeshStandardMaterial({ map: makePlanetTexture('moon'), roughness: 1, metalness: 0 }));
  planetSys.add(moon);

  // ── Nebula clouds (soft colored backdrop) ──
  const nebula = [];
  [[accentA, -260, 120, -320, 520], [accentB, 320, -90, -380, 460], ['#f472b6', -60, -160, -300, 360]].forEach(([col, x, y, z, sc]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(col), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(x, y, z); sp.scale.set(sc, sc, 1); scene.add(sp); nebula.push(sp);
  });

  // ── Shooting stars (periodic streaks) ──
  const shooters = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color('#ffffff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(sp); shooters.push({ sp, active: false, next: 800 + i * 1400 + Math.random() * 2000, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
  }
  function spawnShooter(s, now) {
    s.active = true; s.life = 0; s.maxLife = 900 + Math.random() * 700;
    s.x = -300 + Math.random() * 120; s.y = 120 + Math.random() * 160; s.z = -200 + Math.random() * 300;
    s.vx = 0.42 + Math.random() * 0.3; s.vy = -(0.16 + Math.random() * 0.14); s.vz = (Math.random() - 0.5) * 0.1;
    s.sp.scale.set(26, 2.4, 1);
  }

  const size = () => { const w = window.innerWidth || 1, h = window.innerHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size();
  window.addEventListener('resize', size);

  let raf = 0, t0 = performance.now(), last = t0;
  let zoom = null;            // { start, dur, cb }
  let camR = 235, camY = 95;  // orbit radius / height
  function frame() {
    const now = performance.now();
    const dt = Math.min(64, now - last); last = now;
    const el = (now - t0) * 0.001;
    galaxy.rotation.y = el * 0.16;
    bgStars.rotation.y = el * 0.012;
    earth.rotation.y = el * 0.22;
    // moon orbits the planet
    const ma = el * 0.6; moon.position.set(Math.cos(ma) * 52, Math.sin(ma) * 10, Math.sin(ma) * 52);
    nebula.forEach((nb, i) => { nb.material.rotation = el * (0.02 + i * 0.01); });
    // shooting stars
    shooters.forEach((s) => {
      if (!s.active) { s.next -= dt; if (s.next <= 0) { spawnShooter(s, now); } return; }
      s.life += dt; const p = s.life / s.maxLife;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.sp.position.set(s.x, s.y, s.z);
      s.sp.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.95;
      if (p >= 1) { s.active = false; s.sp.material.opacity = 0; s.next = 1500 + Math.random() * 4000; }
    });

    let camAng = el * 0.12;
    if (zoom) {
      const p = Math.min(1, (now - zoom.start) / zoom.dur);
      const e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;  // easeInOutCubic
      camR = 235 - e * 232;          // dolly toward the core
      camY = 95  - e * 86;
      galaxy.rotation.y += e * 2.2;   // spin up dramatically
      canvas.style.opacity = String(1 - Math.max(0, (p - 0.72) / 0.28));
      if (p >= 1) { const cb = zoom.cb; zoom = null; cancelAnimationFrame(raf); raf = 0; cb && cb(); return; }
    }
    camera.position.set(Math.cos(camAng) * camR, camY, Math.sin(camAng) * camR);
    camera.lookAt(0, 0, 0);
    coreSprite.position.set(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    zoomIn(durationMs, cb) { zoom = { start: performance.now(), dur: durationMs || 1500, cb }; },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      try {
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
        renderer.dispose();
      } catch (e) {}
    },
  };
};

// Mark availability so the Hero can detect & retry if React mounted first.
window.__galaxyReady = true;
window.dispatchEvent(new CustomEvent('__galaxyReady'));

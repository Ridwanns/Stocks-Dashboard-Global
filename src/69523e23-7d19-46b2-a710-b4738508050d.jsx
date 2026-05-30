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
    try { STATE.renderer?.forceContextLoss(); } catch (e) {}
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

  // Layered background stars (two shells → parallax depth) + the spiral galaxy.
  const bgStars = buildBackgroundStars(2600, 620, 1500); scene.add(bgStars);
  const bgStars2 = buildBackgroundStars(1500, 300, 600); bgStars2.material.opacity = 0.7; scene.add(bgStars2);
  const galaxy = buildSpiralGalaxy(accentA, accentB);
  galaxy.rotation.x = -0.92; scene.add(galaxy);

  // Glowing galaxy core.
  const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color('#fff0d0'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreSprite.scale.set(60, 60, 1); scene.add(coreSprite);

  // ── Earth — STATIONARY centrepiece, clearly separated from the galaxy ──
  const planetSys = new THREE.Group(); planetSys.position.set(-186, 30, -24); scene.add(planetSys);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(34, 56, 56), new THREE.MeshStandardMaterial({ map: makePlanetTexture('earth'), roughness: 1, metalness: 0 }));
  earth.rotation.z = 0.36; planetSys.add(earth);            // fixed tilt, no spin
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(37, 40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(accentB), transparent: true, opacity: 0.17, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  planetSys.add(atmo);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(accentB), transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(104, 104, 1); planetSys.add(glow);

  // Tilted orbit plane around Earth: faint ring + moon + bright orbiting sparks.
  const orbit = new THREE.Group(); orbit.rotation.set(1.12, 0, 0.24); planetSys.add(orbit);
  const ORBIT_R = 64;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ORBIT_R, 0.22, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(accentB), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  orbit.add(ring);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 28, 28), new THREE.MeshStandardMaterial({ map: makePlanetTexture('moon'), roughness: 1, metalness: 0 }));
  orbit.add(moon);
  // bright sparks circling Earth alongside the moon ("ada yg mengitari")
  const orbiters = [];
  [[ORBIT_R, 0, '#ffffff', 5.0], [ORBIT_R, 2.3, accentB, 4.2], [ORBIT_R, 4.4, '#fff0d0', 5.6], [46, 1.1, accentA, 3.6]].forEach(([r, ph, col, sz]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(col), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(sz, sz, 1); orbit.add(sp); orbiters.push({ sp, r, ph, base: sz });
  });

  // ── Twinkling spark layer scattered through the void ──
  const sparks = [];
  const srng = mulberry(2027);
  for (let i = 0; i < 48; i++) {
    const col = ['#ffffff', accentA, accentB, '#fff0d0'][Math.floor(srng() * 4)];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(col), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    const rad = 150 + srng() * 360, u = srng() * 2 - 1, th = srng() * Math.PI * 2, sx = Math.sqrt(1 - u * u);
    sp.position.set(Math.cos(th) * sx * rad, u * rad * 0.7, Math.sin(th) * sx * rad);
    const base = 3 + srng() * 5; sp.scale.set(base, base, 1);
    scene.add(sp); sparks.push({ sp, base, phase: srng() * Math.PI * 2, speed: 1.3 + srng() * 2.4 });
  }

  // ── Nebula clouds (soft, atmospheric — pushed far back) ──
  const nebula = [];
  [[accentA, -320, 160, -460, 560], [accentB, 380, -130, -500, 500], ['#f472b6', 60, -210, -400, 380]].forEach(([col, x, y, z, sc]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(col), transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.position.set(x, y, z); sp.scale.set(sc, sc, 1); scene.add(sp); nebula.push(sp);
  });

  // ── Shooting stars (rare + graceful) ──
  const shooters = [];
  for (let i = 0; i < 2; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color('#dbe6ff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(sp); shooters.push({ sp, active: false, next: 2800 + i * 3400 + Math.random() * 3000, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
  }
  function spawnShooter(s) {
    s.active = true; s.life = 0; s.maxLife = 1700 + Math.random() * 900;
    s.x = -340 + Math.random() * 120; s.y = 150 + Math.random() * 140; s.z = -160 + Math.random() * 240;
    s.vx = 0.20 + Math.random() * 0.12; s.vy = -(0.07 + Math.random() * 0.05); s.vz = (Math.random() - 0.5) * 0.05;
    s.sp.scale.set(22, 2, 1);
  }

  const size = () => { const w = window.innerWidth || 1, h = window.innerHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size();
  window.addEventListener('resize', size);

  let raf = 0, t0 = performance.now(), last = t0;
  let zoom = null;            // { start, dur, cb }
  let camR = 262, camY = 86;  // orbit radius / height (pulled back, calmer)
  function frame() {
    const now = performance.now();
    const dt = Math.min(64, now - last); last = now;
    const el = (now - t0) * 0.001;
    galaxy.rotation.y = el * 0.05;     // slow, calm
    bgStars.rotation.y = el * 0.004;   // barely drifting
    // Earth is stationary. Moon + sparks orbit it in the tilted ring plane.
    const ma = el * 0.5;
    moon.position.set(Math.cos(ma) * ORBIT_R, 0, Math.sin(ma) * ORBIT_R);
    orbiters.forEach((o, i) => {
      const a = ma * (0.8 + i * 0.16) + o.ph;
      o.sp.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
      const tw = 0.6 + 0.4 * Math.sin(el * 3.5 + o.ph); o.sp.scale.set(o.base * tw, o.base * tw, 1);
    });
    // twinkling spark layer
    sparks.forEach((s) => {
      const tw = 0.45 + 0.55 * Math.sin(el * s.speed + s.phase);
      const sc = s.base * (0.5 + 0.6 * tw); s.sp.scale.set(sc, sc, 1);
      s.sp.material.opacity = 0.3 + 0.65 * tw;
    });
    nebula.forEach((nb, i) => { nb.material.rotation = el * (0.008 + i * 0.005); });
    // shooting stars
    shooters.forEach((s) => {
      if (!s.active) { s.next -= dt; if (s.next <= 0) { spawnShooter(s); } return; }
      s.life += dt; const p = s.life / s.maxLife;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.sp.position.set(s.x, s.y, s.z);
      s.sp.material.opacity = Math.sin(Math.min(1, p) * Math.PI) * 0.9;
      if (p >= 1) { s.active = false; s.sp.material.opacity = 0; s.next = 3000 + Math.random() * 5000; }
    });

    let camAng = el * 0.03;    // slow cinematic orbit
    if (zoom) {
      const p = Math.min(1, (now - zoom.start) / zoom.dur);
      const e = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;  // easeInOutCubic
      camR = 262 - e * 258;          // dolly toward the core
      camY = 86  - e * 78;
      galaxy.rotation.y += e * 2.0;   // spin up on the way in
      canvas.style.opacity = String(1 - Math.max(0, (p - 0.72) / 0.28));
      if (p >= 1) { const cb = zoom.cb; zoom = null; cancelAnimationFrame(raf); raf = 0; cb && cb(); return; }
    }
    camera.position.set(Math.cos(camAng) * camR, camY, Math.sin(camAng) * camR);
    camera.lookAt(0, 0, 0);
    // Gently breathing galaxy core for a touch of life.
    const corePulse = 60 * (1 + 0.08 * Math.sin(el * 0.9));
    coreSprite.position.set(0, 0, 0);
    coreSprite.scale.set(corePulse, corePulse, 1);
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

// ════════════════════════════════════════════════════════════════════
// MARKET GLOBE — a rotating Earth for the Overview tab with glowing markers
// at each global exchange. Returns { stop, setData(indices), onFront(cb) }.
// ════════════════════════════════════════════════════════════════════
function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

window.startMarketGlobe = function startMarketGlobe(canvas, markets, opts) {
  opts = opts || {};
  if (!THREE) return { stop(){}, setData(){}, onFront(){} };
  markets = markets || [];
  const accentA = opts.accentA || '#8b5cf6', accentB = opts.accentB || '#22d3ee';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
  camera.position.set(0, 14, 290);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x5a6aa0, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(-0.7, 0.45, 1); scene.add(sun);

  const R = 92;
  const earthGroup = new THREE.Group(); earthGroup.rotation.z = 0.18; scene.add(earthGroup);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), new THREE.MeshStandardMaterial({ map: makePlanetTexture('earth'), roughness: 1, metalness: 0 }));
  earthGroup.add(earth);
  // graticule wireframe for a "data globe" feel
  const grid = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 36, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(accentB), wireframe: true, transparent: true, opacity: 0.06, depthWrite: false }));
  earthGroup.add(grid);
  // atmosphere + soft glow
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 48, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(accentB), transparent: true, opacity: 0.15, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(atmo);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(accentB), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(R * 3.6, R * 3.6, 1); scene.add(glow);
  // faint backdrop stars
  const bg = buildBackgroundStars(700, 320, 760); scene.add(bg);

  // markers parented to the earth group so they spin with the globe
  const markerMap = {};
  markets.forEach((m) => {
    const pos = latLonToVec3(m.lat, m.lon, R * 1.015);
    const normal = pos.clone().normalize();
    const grp = new THREE.Group();
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeStarSprite(), color: new THREE.Color(accentB), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    dot.scale.set(13, 13, 1); dot.position.copy(pos); grp.add(dot);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, R * 0.16, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(accentB), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.copy(normal.clone().multiplyScalar(R * 1.08));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    grp.add(beam);
    earthGroup.add(grp);
    markerMap[m.id] = { dot, beam, lx: pos.x, lz: pos.z, base: 13 };
  });

  const size = () => {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
    const h = canvas.clientHeight || 320;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  size();
  requestAnimationFrame(size); setTimeout(size, 200); setTimeout(size, 700);
  window.addEventListener('resize', size);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(size); try { ro.observe(canvas); } catch (e) {} }

  let raf = 0, t0 = performance.now(), frontId = null, frontCb = null;
  function frame() {
    const el = (performance.now() - t0) * 0.001;
    const ry = el * 0.16;
    earthGroup.rotation.y = ry;
    // front-most marker (max world-z after Y rotation) — pulse + report it
    let best = null, bestZ = -Infinity;
    for (const id in markerMap) {
      const mk = markerMap[id];
      const wz = -mk.lx * Math.sin(ry) + mk.lz * Math.cos(ry);
      if (wz > bestZ) { bestZ = wz; best = id; }
      const tw = 0.8 + 0.25 * Math.sin(el * 3 + mk.lx);
      mk.dot.scale.set(mk.base * tw, mk.base * tw, 1);
    }
    if (best && best !== frontId) { frontId = best; if (frontCb) frontCb(frontId); }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      if (ro) { try { ro.disconnect(); } catch (e) {} }
      try { scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); try { renderer.forceContextLoss(); } catch(fe){} renderer.dispose(); } catch (e) {}
    },
    setData(indices) {
      indices = indices || {};
      for (const id in markerMap) {
        const d = indices[id];
        const c = !d ? accentB : (d.chgPct >= 0 ? '#34d399' : '#fb7185');
        markerMap[id].dot.material.color.set(c);
        markerMap[id].beam.material.color.set(c);
      }
    },
    onFront(cb) { frontCb = cb; if (frontId) cb(frontId); },
  };
};

// Mark availability so the Hero can detect & retry if React mounted first.
window.__galaxyReady = true;
window.dispatchEvent(new CustomEvent('__galaxyReady'));

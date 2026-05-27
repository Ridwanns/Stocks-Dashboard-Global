// ════════════════════════════════════════════════════════════════════
// WebGL galaxy — three.js particles drifting in a slow rotating sphere.
// Lives in the hero section; the page's React code calls window.startGalaxy
// (canvas, accentHex) once the hero canvas mounts.
// ════════════════════════════════════════════════════════════════════

import * as THREE from 'three';

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
    const rect = canvas.getBoundingClientRect();
    resize(rect.width || canvas.clientWidth || 1, rect.height || canvas.clientHeight || 1);
  };
  onResize();
  window.addEventListener('resize', onResize);

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
    STATE.renderer?.dispose();
    STATE.renderer = null;
  };
};

// Mark availability so the Hero can detect & retry if React mounted first.
window.__galaxyReady = true;
window.dispatchEvent(new CustomEvent('__galaxyReady'));

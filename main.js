/**
 * FAIT — 3D Galaxy Portfolio
 * main.js
 *
 * Plain ES-module script (no bundler). Loaded via <script type="module">.
 * Three.js r160 + OrbitControls resolved through the importmap in index.html.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PARTICLE_COUNT      = window.innerWidth < 600 ? 4500 : 9000;
const SNAP_DURATION       = 1.5;   // seconds — full animation
const SNAP_DURATION_SHORT = 0.35;  // seconds — prefers-reduced-motion
const IDLE_DRIFT_DELAY    = 4.0;   // seconds of inactivity before drift starts
const DRAG_THRESHOLD      = 6;     // pixels — click vs drag discrimination

const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const snapDuration = prefersReducedMotion ? SNAP_DURATION_SHORT : SNAP_DURATION;

// ─────────────────────────────────────────────────────────────────────────────
// Project data
// ─────────────────────────────────────────────────────────────────────────────

const PROJECTS = [
  {
    key:   'consulting',
    name:  'FAIT Consulting',
    color: 0x00e5ff,                           // electric cyan
    siteUrl:        'https://consulting.itsfait.com',
    starPosition:   new THREE.Vector3(-5.5,  0.8, -2.5),
    cameraPosition: new THREE.Vector3(-5.5,  3.8,  5.0),
    cameraTarget:   new THREE.Vector3(-5.5,  0.8, -2.5),
    caseStudy: {
      problem:
        'Businesses struggle to pinpoint where AI genuinely reduces friction versus where it adds new complexity. Most automation projects stall or fail because they address the wrong problem.',
      approach:
        'We run structured discovery sessions to map operational workflows, identify high-ROI automation candidates, and build focused AI integrations that fit existing teams — not the reverse. ' +
        'Every engagement starts with a working prototype before any long-term commitment.',
      outcome:
        'Clients reduced manual processing time by an average of 60%, deploying tooling their teams actually adopt. ' +
        'One regional services firm cut dispatch overhead by four hours per day with an AI-assisted scheduling system.',
      stack: 'Python, OpenAI API, Anthropic Claude, n8n, Zapier, PostgreSQL, REST APIs',
    },
  },
  {
    key:   'homeservices',
    name:  'FAIT Home Services',
    color: 0xe040fb,                           // vibrant magenta
    siteUrl:        'https://itsfait.com',
    starPosition:   new THREE.Vector3( 5.0, -0.5,  2.5),
    cameraPosition: new THREE.Vector3( 5.0,  3.0,  9.5),
    cameraTarget:   new THREE.Vector3( 5.0, -0.5,  2.5),
    caseStudy: {
      problem:
        'Home service operators — contractors, cleaners, landscapers — spend significant time on scheduling, quoting, and follow-up, pulling focus away from billable work and customer relationships.',
      approach:
        'Built a purpose-built operations platform for small home service businesses: AI-assisted quoting from job photos, automated scheduling with route optimisation, and customer communication workflows triggered by job status. ' +
        'Designed to be adopted without a learning curve.',
      outcome:
        'Beta operators reported 3–5 hours saved per week on administration, with faster quote turnaround increasing close rates. ' +
        'One early user attributed two additional booked jobs per week directly to automated follow-up.',
      stack: 'SvelteKit, Node.js, PostgreSQL, Google Maps API, OpenAI Vision, Twilio, Stripe',
    },
  },
  {
    key:   'portfolio',
    name:  'My portfolio of sites',
    color: 0xffab40,                           // warm amber
    siteUrl:        'https://portfolio.itsfait.com',
    starPosition:   new THREE.Vector3( 0.5,  2.5, -7.0),
    cameraPosition: new THREE.Vector3( 0.5,  5.5,  0.0),
    cameraTarget:   new THREE.Vector3( 0.5,  2.5, -7.0),
    caseStudy: {
      problem:
        'Clients and collaborators needed a fast, credible way to evaluate work quality and range across web, AI tooling, and operational software — without wading through a generic résumé or scattered links.',
      approach:
        'Designed and built a cohesive portfolio showcasing selected case studies across consulting, product, and engineering work. ' +
        'Emphasis on clarity: each project communicates the problem, the method, and the measurable result. This site is part of that portfolio.',
      outcome:
        'Serves as the primary outbound reference for new client enquiries, reducing time-to-qualification for inbound leads. ' +
        'Built and deployed in under one week.',
      stack: 'HTML, CSS, JavaScript, Three.js, Netlify, GitHub Actions',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Application state
// ─────────────────────────────────────────────────────────────────────────────

let currentIndex  = 0;       // which project is selected
let hoveredIndex  = -1;      // which project star the cursor is over (-1 = none)

// Camera snap state
let isSnapping    = false;
let snapElapsed   = 0;
const snapStart   = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
const snapEnd     = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
const liveTarget  = new THREE.Vector3(); // mirrors controls.target during snap

// Click vs drag
let mouseDownX = 0;
let mouseDownY = 0;

// Idle drift
let lastInteractionAt = performance.now();

// Pulse animation for selected star
let pulseT = 0;

// Audio
let audioCtx     = null;
let masterGain   = null;
let soundEnabled = false;
let hasInteracted = false;

// ─────────────────────────────────────────────────────────────────────────────
// Renderer + Scene + Camera
// ─────────────────────────────────────────────────────────────────────────────

const container = document.getElementById('scene-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020814);
scene.fog = new THREE.FogExp2(0x020814, 0.009);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  800,
);
camera.position.set(0, 12, 22);

// OrbitControls — free-fly while not snapping
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.minDistance    = 3;
controls.maxDistance    = 55;
controls.maxPolarAngle  = Math.PI * 0.80;
controls.minPolarAngle  = Math.PI * 0.05;
liveTarget.copy(controls.target);

// ─────────────────────────────────────────────────────────────────────────────
// Shared circular particle texture (soft radial gradient → round points)
// ─────────────────────────────────────────────────────────────────────────────

function makeCircleTex(size = 64) {
  const c   = document.createElement('canvas');
  c.width   = c.height = size;
  const ctx = c.getContext('2d');
  const r   = size / 2;
  const g   = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.90)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.28)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const starTex = makeCircleTex(64);

// ─────────────────────────────────────────────────────────────────────────────
// Galaxy background — spiral arm particle field
// ─────────────────────────────────────────────────────────────────────────────

(function buildGalaxy() {
  const count     = PARTICLE_COUNT;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);
  const col       = new THREE.Color();
  const ARMS      = 3;

  for (let i = 0; i < count; i++) {
    // Distribute along spiral arms
    const arm    = i % ARMS;
    const spin   = (arm / ARMS) * Math.PI * 2;
    // Bias toward outer radius with pow
    const r      = Math.pow(Math.random(), 0.55) * 17 + 0.4;
    const angle  = spin + r * 0.32 + (Math.random() - 0.5) * 0.55;
    const spread = 0.22 + r * 0.035;

    positions[i * 3]     = Math.cos(angle) * r + (Math.random() - 0.5) * spread * 2.4;
    positions[i * 3 + 1] = (Math.random() - 0.5) * (2.8 - r * 0.09);
    positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread * 2.4;

    // Colour: cyan core → blue-purple mid → magenta outer edge
    const nR = Math.min(r / 17, 1);
    if (nR < 0.22) {
      // Core: bright cyan / teal
      col.setHSL(0.52, 0.90, 0.62 + Math.random() * 0.22);
    } else if (nR < 0.58) {
      // Mid: blue to violet
      col.setHSL(0.63 + Math.random() * 0.09, 0.80, 0.44 + Math.random() * 0.20);
    } else {
      // Outer: magenta / deep pink
      col.setHSL(0.82 + Math.random() * 0.07, 0.72, 0.40 + Math.random() * 0.18);
    }

    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size:            0.13,
    vertexColors:    true,
    map:             starTex,
    alphaMap:        starTex,
    transparent:     true,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    sizeAttenuation: true,
  });

  scene.add(new THREE.Points(geo, mat));
})();

// Faint outer halo — a looser scatter of dim stars for depth
(function buildHalo() {
  const count     = Math.floor(PARTICLE_COUNT * 0.18);
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);
  const col       = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 18 + Math.random() * 14;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.35;
    positions[i * 3 + 2] = r * Math.cos(phi);
    col.setHSL(0.60 + Math.random() * 0.18, 0.40, 0.30 + Math.random() * 0.15);
    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size: 0.09, vertexColors: true, map: starTex, alphaMap: starTex,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });

  scene.add(new THREE.Points(geo, mat));
})();

// ─────────────────────────────────────────────────────────────────────────────
// Project stars — glowing sphere meshes
// ─────────────────────────────────────────────────────────────────────────────

const starGroups    = [];   // { group, coreMat, innerMat, haloMat, light }
const raycastMeshes = [];   // core sphere meshes for raycasting

PROJECTS.forEach((proj, idx) => {
  const group = new THREE.Group();
  group.position.copy(proj.starPosition);

  // ── Core sphere ──
  const coreGeo = new THREE.SphereGeometry(0.28, 32, 32);
  const coreMat = new THREE.MeshBasicMaterial({ color: proj.color });
  const core    = new THREE.Mesh(coreGeo, coreMat);
  core.userData.projectIndex = idx;
  group.add(core);
  raycastMeshes.push(core);

  // ── Inner glow (BackSide, additive) ──
  const innerMat = new THREE.MeshBasicMaterial({
    color:       proj.color,
    transparent: true,
    opacity:     0.20,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.BackSide,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.50, 32, 32), innerMat));

  // ── Outer halo (larger, very soft) ──
  const haloMat = new THREE.MeshBasicMaterial({
    color:       proj.color,
    transparent: true,
    opacity:     0.06,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.BackSide,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.90, 32, 32), haloMat));

  // ── Point light for local scene illumination ──
  const light = new THREE.PointLight(proj.color, 1.2, 9);
  group.add(light);

  scene.add(group);
  starGroups.push({ group, coreMat, innerMat, haloMat, light });
});

// Ambient fill light
scene.add(new THREE.AmbientLight(0x0d1a33, 0.8));

// ─────────────────────────────────────────────────────────────────────────────
// Audio — Web Audio API, synthesised (no external files needed)
// ─────────────────────────────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioCtx.destination);

    // Space drone — four layered sine/triangle oscillators with slow LFO wobble
    const droneConfig = [
      { freq: 40,  type: 'sine',     vol: 0.55, lfoRate: 0.07 },
      { freq: 80,  type: 'sine',     vol: 0.28, lfoRate: 0.11 },
      { freq: 121, type: 'triangle', vol: 0.10, lfoRate: 0.09 },
      { freq: 162, type: 'sine',     vol: 0.07, lfoRate: 0.13 },
    ];

    droneConfig.forEach(({ freq, type, vol, lfoRate }) => {
      const osc      = audioCtx.createOscillator();
      const oscGain  = audioCtx.createGain();
      const lfo      = audioCtx.createOscillator();
      const lfoGain  = audioCtx.createGain();

      osc.type            = type;
      osc.frequency.value = freq;
      oscGain.gain.value  = vol * 0.055;

      lfo.type            = 'sine';
      lfo.frequency.value = lfoRate;
      lfoGain.gain.value  = freq * 0.022;    // subtle pitch wobble

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(oscGain);
      oscGain.connect(masterGain);

      lfo.start();
      osc.start();
    });
  } catch (_) {
    // Web Audio unavailable — silently no-op
  }
}

function startAmbient() {
  if (!audioCtx || !soundEnabled) return;
  masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.28, audioCtx.currentTime + 2.2);
}

function stopAmbient() {
  if (!audioCtx) return;
  masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.7);
}

/**
 * Swoosh — filtered white noise burst with a fast frequency sweep.
 * Attack is near-instant; the bandpass centre sweeps high→low over ~0.5 s.
 */
function playPing() {
  if (!audioCtx || !soundEnabled) return;
  try {
    const now      = audioCtx.currentTime;
    const duration = 0.55;

    // White noise source via AudioBuffer
    const bufSize  = audioCtx.sampleRate * duration;
    const buf      = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data     = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise    = audioCtx.createBufferSource();
    noise.buffer   = buf;

    // Bandpass sweeps from 3200 Hz down to 400 Hz
    const bp       = audioCtx.createBiquadFilter();
    bp.type        = 'bandpass';
    bp.Q.value     = 1.4;
    bp.frequency.setValueAtTime(3200, now);
    bp.frequency.exponentialRampToValueAtTime(400, now + duration);

    // Amplitude envelope — sharp attack, smooth tail
    const env      = audioCtx.createGain();
    env.gain.setValueAtTime(0,    now);
    env.gain.linearRampToValueAtTime(0.55, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(bp);
    bp.connect(env);
    env.connect(masterGain);

    noise.start(now);
    noise.stop(now + duration);
  } catch (_) { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel — update DOM content for a given project index
// ─────────────────────────────────────────────────────────────────────────────

function updatePanel(idx, animate = true) {
  const proj    = PROJECTS[idx];
  const content = document.querySelector('.panel-content');

  function write() {
    document.getElementById('project-name').textContent = proj.name;
    document.getElementById('cs-problem').textContent   = proj.caseStudy.problem;
    document.getElementById('cs-approach').textContent  = proj.caseStudy.approach;
    document.getElementById('cs-outcome').textContent   = proj.caseStudy.outcome;
    document.getElementById('cs-stack').textContent     = proj.caseStudy.stack;
    document.getElementById('project-counter').textContent =
      `${idx + 1}\u2009/\u2009${PROJECTS.length}`;

    // Screenshot + link
    const screenshotUrl = `https://image.thum.io/get/width/640/crop/400/${proj.siteUrl}`;
    const img  = document.getElementById('project-screenshot');
    const link = document.getElementById('project-link');
    img.src    = screenshotUrl;
    img.alt    = `${proj.name} homepage screenshot`;
    link.href  = proj.siteUrl;

    content.scrollTop = 0;
  }

  if (animate && !prefersReducedMotion) {
    content.style.opacity   = '0';
    content.style.transform = 'translateY(10px)';
    setTimeout(() => {
      write();
      content.style.opacity   = '1';
      content.style.transform = 'translateY(0)';
    }, 210);
  } else {
    write();
    content.style.opacity   = '1';
    content.style.transform = 'translateY(0)';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Star visual state — scale + glow intensity per state
// ─────────────────────────────────────────────────────────────────────────────

function updateStarVisuals() {
  starGroups.forEach(({ group, innerMat, haloMat, light }, idx) => {
    const selected = idx === currentIndex;
    const hovered  = idx === hoveredIndex;

    // Base scale (pulse is layered on top in the render loop)
    if (!selected) {
      group.scale.setScalar(hovered ? 1.22 : 1.0);
    }
    // Glow opacity
    innerMat.opacity = selected ? 0.28 : hovered ? 0.22 : 0.18;
    haloMat.opacity  = selected ? 0.13 : hovered ? 0.09 : 0.055;
    // Light intensity
    light.intensity  = selected ? 2.4  : hovered ? 1.8  : 1.2;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Easing function
// ─────────────────────────────────────────────────────────────────────────────

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// focusProject — initiate a cinematic camera snap to the given index
// ─────────────────────────────────────────────────────────────────────────────

function focusProject(idx) {
  // Wrap around
  currentIndex = ((idx % PROJECTS.length) + PROJECTS.length) % PROJECTS.length;
  const proj   = PROJECTS[currentIndex];

  snapStart.pos.copy(camera.position);
  snapStart.tgt.copy(liveTarget);
  snapEnd.pos.copy(proj.cameraPosition);
  snapEnd.tgt.copy(proj.cameraTarget);

  isSnapping    = true;
  snapElapsed   = 0;
  controls.enabled = false;

  pulseT = 0; // reset pulse phase on new selection

  playPing();
  updatePanel(currentIndex, true);
  updateStarVisuals();
}

// ─────────────────────────────────────────────────────────────────────────────
// Raycasting helpers
// ─────────────────────────────────────────────────────────────────────────────

const raycaster = new THREE.Raycaster();

function screenToNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width)  *  2 - 1,
    ((clientY - rect.top)  / rect.height) * -2 + 1,
  );
}

function hitTestStars(clientX, clientY) {
  raycaster.setFromCamera(screenToNDC(clientX, clientY), camera);
  const hits = raycaster.intersectObjects(raycastMeshes);
  return hits.length > 0 ? hits[0].object.userData.projectIndex : -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// First-interaction gate — audio context must start on user gesture
// ─────────────────────────────────────────────────────────────────────────────

function markInteraction() {
  lastInteractionAt = performance.now();
  if (!hasInteracted) {
    hasInteracted = true;
    initAudio();
    if (soundEnabled) startAmbient();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event listeners
// ─────────────────────────────────────────────────────────────────────────────

// Hover — update hoveredIndex, cursor style, star visuals
renderer.domElement.addEventListener('mousemove', (e) => {
  markInteraction();
  const hit = hitTestStars(e.clientX, e.clientY);
  if (hit !== hoveredIndex) {
    hoveredIndex = hit;
    container.classList.toggle('hovering-star', hit >= 0);
    updateStarVisuals();
  }
});

// Click — only if the pointer did not drag
renderer.domElement.addEventListener('mousedown', (e) => {
  mouseDownX = e.clientX;
  mouseDownY = e.clientY;
});

renderer.domElement.addEventListener('mouseup', (e) => {
  markInteraction();
  const dx = Math.abs(e.clientX - mouseDownX);
  const dy = Math.abs(e.clientY - mouseDownY);
  if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
    const hit = hitTestStars(e.clientX, e.clientY);
    if (hit >= 0) focusProject(hit);
  }
});

// Touch — single tap on a star
renderer.domElement.addEventListener('touchend', (e) => {
  markInteraction();
  if (e.changedTouches.length > 0) {
    const t   = e.changedTouches[0];
    const hit = hitTestStars(t.clientX, t.clientY);
    if (hit >= 0) focusProject(hit);
  }
}, { passive: true });

// Arrow navigation
document.getElementById('prev-btn').addEventListener('click', () => {
  markInteraction();
  focusProject(currentIndex - 1);
});

document.getElementById('next-btn').addEventListener('click', () => {
  markInteraction();
  focusProject(currentIndex + 1);
});

// Keyboard arrow navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    markInteraction();
    focusProject(currentIndex - 1);
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    markInteraction();
    focusProject(currentIndex + 1);
  }
});

// Sound toggle
const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', () => {
  markInteraction();
  soundEnabled = !soundEnabled;
  soundBtn.setAttribute('aria-pressed', String(soundEnabled));
  soundBtn.setAttribute('aria-label', soundEnabled ? 'Disable sound' : 'Enable sound');
  if (soundEnabled) {
    if (!audioCtx) initAudio();
    startAmbient();
  } else {
    stopAmbient();
  }
});

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─────────────────────────────────────────────────────────────────────────────
// Render loop
// ─────────────────────────────────────────────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const now   = performance.now();

  // ── Camera snap interpolation ──────────────────────────────────────────
  if (isSnapping) {
    snapElapsed += delta;
    const rawT = Math.min(snapElapsed / snapDuration, 1);
    const t    = easeInOutCubic(rawT);

    camera.position.lerpVectors(snapStart.pos, snapEnd.pos, t);
    liveTarget.lerpVectors(snapStart.tgt, snapEnd.tgt, t);
    controls.target.copy(liveTarget);

    if (rawT >= 1) {
      isSnapping       = false;
      controls.enabled = true;
    }
  } else {
    // ── Idle drift — very subtle sinusoidal camera nudge ─────────────────
    if (!prefersReducedMotion) {
      const idleSecs = (now - lastInteractionAt) / 1000;
      if (idleSecs > IDLE_DRIFT_DELAY) {
        const t = now * 0.001;
        camera.position.x += Math.sin(t * 0.28) * 0.00055;
        camera.position.y += Math.sin(t * 0.19) * 0.00030;
      }
    }
  }

  // ── Pulse animation on selected star ──────────────────────────────────
  pulseT += delta * 1.6;
  const pulseFactor = 1.0 + Math.sin(pulseT) * 0.07;
  const sg = starGroups[currentIndex];
  if (sg) sg.group.scale.setScalar(1.45 * pulseFactor);

  controls.update();
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialise
// ─────────────────────────────────────────────────────────────────────────────

// Populate panel immediately (no fade on first paint)
updatePanel(0, false);
updateStarVisuals();

// Brief pause so the user sees the galaxy overview, then snap to project 0
setTimeout(() => focusProject(0), 700);

animate();

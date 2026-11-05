/* Groupe Cléroux — Laval en diorama.
   Une maquette d'île posée sur un socle : la tempête recouvre la ville, puis la flotte
   sort des deux sites et dégage les rues, les entrées et les stationnements un par un.
   Tout est piloté par une seule valeur : la progression du défilement (0 → 1). */
import * as THREE from "./vendor/three.module.min.js";

/* ---------- utilitaires ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = rng(20251105);
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

/* Courbe de valeurs indexée sur la progression : [[p, v], ...] */
function track(keys) {
  return p => {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (p <= keys[i][0]) { const [p0, v0] = keys[i - 1], [p1, v1] = keys[i]; const t = smooth(0, 1, (p - p0) / (p1 - p0)); return lerp(v0, v1, t); }
    }
    return keys[keys.length - 1][1];
  };
}

/* ---------- l'ambiance au fil du récit ---------- */
const A = {
  snow:   track([[0, .18], [.10, .32], [.22, .9], [.34, 1], [.48, .8], [.70, .55], [.80, .18], [.86, 0], [1, 0]]),
  cover:  track([[0, 0], [.10, .06], [.22, .5], [.33, 1], [1, 1]]),
  dark:   track([[0, .04], [.12, .18], [.24, .55], [.36, .82], [.72, .86], [.82, .5], [.90, .1], [1, 0]]),
  warm:   track([[0, .1], [.70, 0], [.80, .85], [.88, .6], [1, .12]]),
  beacon: track([[0, 0], [.36, 0], [.42, 1], [.86, 1], [.94, 0], [1, 0]]),
  wind:   track([[0, .2], [.24, 1], [.5, .8], [.8, .2], [1, 0]]),
  blur:   track([[0, 1], [.40, .85], [.55, .75], [.85, .9], [1, 1.25]])
};

/* ---------- caméra : images clés ---------- */
const CAM = [
  { p: 0.00, pos: [43, 33, 49], tgt: [-7.5, -2, 6.5], focus: .5 },
  { p: 0.16, pos: [34, 24, 37], tgt: [-2, -1, 1], focus: .5 },
  { p: 0.32, pos: [24, 14, 20], tgt: [7, 0, -3], focus: .52 },
  { p: 0.43, pos: [19, 7.5, 8.5], tgt: [9, .3, -3.4], focus: .55 },
  { p: 0.53, pos: [6, 9, 14], tgt: [-3, 0, -.5], focus: .55 },
  { p: 0.63, pos: [-7, 8.5, 21.5], tgt: [-11, 0, 8], focus: .56 },
  { p: 0.73, pos: [9, 11, -24], tgt: [0, 0, -5], focus: .54 },
  { p: 0.86, pos: [30, 34, 36], tgt: [0, -1, 0], focus: .5 },
  { p: 1.00, pos: [2, 66, 27], tgt: [0, -1, 1.5], focus: .5 }
];

/* ---------- plan de la ville ---------- */
const ISLAND = { rx: 28.5, rz: 17.5 };
const islandR = th => 1 + 0.035 * Math.sin(3 * th + .4) + 0.025 * Math.sin(7 * th + 1.3) + 0.015 * Math.sin(13 * th);
function insideIsland(x, z, margin = 0) {
  const th = Math.atan2(z / ISLAND.rz, x / ISLAND.rx);
  const k = islandR(th);
  const d = Math.hypot(x / (ISLAND.rx * k - margin), z / (ISLAND.rz * k - margin));
  return d < 1;
}
function islandEdgeZ(x, sign) { let z = 0; while (insideIsland(x, z * sign, 0.15) && z < 30) z += 0.05; return z * sign; }

const AVENUES = [-16, -6, 4, 14];
const ROAD_W = { blvd: 2.1, street: 1.2, avenue: 1.3 };

/* Tournées : chaque tronçon « clear » appartient à un seul véhicule. */
const ROUTES = [
  { id: "T1", kind: "plow", p: [.44, .66], pts: [[10, -1.4], [10, 0], [25, 0]], clear: [0, 1], w: ROAD_W.blvd },
  { id: "T2", kind: "plow", p: [.44, .79], pts: [[8, -1.4], [8, 0], [-25, 0]], clear: [0, 1], w: ROAD_W.blvd },
  { id: "T3", kind: "plow", p: [.46, .80], pts: [[9, -6.6], [9, -8], [-22, -8]], clear: [0, 1], w: ROAD_W.street },
  { id: "T4", kind: "plow", p: [.47, .66], pts: [[10.6, -6.6], [10.6, -8], [22, -8]], clear: [0, 1], w: ROAD_W.street },
  { id: "T5", kind: "plow", p: [.45, .80], pts: [[-20, 7.3], [-20, 8], [22, 8]], clear: [0, 1], w: ROAD_W.street },
  { id: "T6", kind: "plow", p: [.45, .80], pts: [[-17.3, 6.4], [-16, 6.4], [-16, 8], [-16, -8], [-6, -8], [-6, 8]], clear: [0, 0, 1, 0, 1], w: ROAD_W.avenue },
  { id: "T7", kind: "plow", p: [.46, .82], pts: [[13.3, -3], [14, -3], [14, -8], [14, -3], [14, 8], [4, 8], [4, -8]], clear: [0, 1, 0, 1, 0, 1], w: ROAD_W.avenue },
  { id: "L1", kind: "loader", p: [.50, .76], pts: [[-5.35, -1.6], [3.35, -1.6], [3.35, -2.7], [-5.35, -2.7], [-5.35, -3.8], [3.35, -3.8], [3.35, -4.9], [-5.35, -4.9]], clear: [1, 0, 1, 0, 1, 0, 1], w: 1.16, lot: "N" },
  { id: "L2", kind: "loader", p: [.48, .74], pts: [[3.35, 1.6], [-5.35, 1.6], [-5.35, 2.7], [3.35, 2.7], [3.35, 3.8], [-5.35, 3.8], [-5.35, 4.9], [3.35, 4.9]], clear: [1, 0, 1, 0, 1, 0, 1], w: 1.16, lot: "S" }
];

export function detectTier() {
  if (window.__FORCE_TIER) return window.__FORCE_TIER;
  if (window.__CAPTURE) return "high";
  let gl = null;
  try { gl = document.createElement("canvas").getContext("webgl2"); } catch (e) { gl = null; }
  if (!gl) return "none";
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 820;
  if (coarse && small) return "mobile";
  let soft = false;
  try { const ext = gl.getExtension("WEBGL_debug_renderer_info"); const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ""; soft = /swiftshader|llvmpipe|software/i.test(r); } catch (e) {}
  if (soft) return "low";
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  return (cores >= 8 && mem >= 8) ? "high" : "mid";
}

/* ---------- textures dessinées ---------- */
function radialTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,.35)") {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(.35, mid); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function speckleTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  g.fillStyle = "#f4f8fb"; g.fillRect(0, 0, 512, 512);
  const r = rng(7);
  for (let i = 0; i < 9000; i++) { const v = 228 + r() * 27; g.fillStyle = `rgba(${v - 10},${v - 3},${v},${.25 + r() * .3})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(210,222,232,${.08 + r() * .1})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function plinthLabel(lines, w = 2048, h = 160) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  g.fillStyle = "#16242f"; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(226,236,243,.86)"; g.textBaseline = "middle";
  g.font = "500 40px 'IBM Plex Mono', ui-monospace, monospace";
  const gap = w / lines.length;
  lines.forEach((t, i) => { g.textAlign = "center"; g.fillText(t, gap * i + gap / 2, h / 2); });
  g.fillStyle = "rgba(226,236,243,.25)"; g.fillRect(40, h - 22, w - 80, 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}

/* ---------- matériau de neige qui s'accumule par plaques et se dégage au passage ---------- */
const NOISE_GLSL = `
float sh(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float sn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(sh(i),sh(i+vec2(1,0)),f.x), mix(sh(i+vec2(0,1)),sh(i+vec2(1,1)),f.x), f.y); }`;
function snowCoverMaterial(shared, instanced) {
  const m = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: .92, metalness: 0 });
  m.defines = { USE_UV: "", ...(instanced ? { SNOW_INST: "" } : {}) };
  m.userData.uClear = { value: 0 };
  m.onBeforeCompile = sh => {
    sh.uniforms.uCover = shared.uCover; sh.uniforms.uNight = shared.uNight; sh.uniforms.uClear = m.userData.uClear;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSnowW;\nvarying float vClear;\n#ifdef SNOW_INST\nattribute float aClear;\n#endif\nuniform float uClear;`)
      .replace("#include <project_vertex>", `#include <project_vertex>\nvec4 sw = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nsw = instanceMatrix*sw;\n#endif\nvSnowW = (modelMatrix*sw).xyz;\n#ifdef SNOW_INST\nvClear = aClear;\n#else\nvClear = uClear;\n#endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vSnowW;\nvarying float vClear;\nuniform float uCover;\nuniform float uNight;\n${NOISE_GLSL}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        float nA = sn(vSnowW.xz*1.6)*.62 + sn(vSnowW.xz*5.3)*.38;
        if (nA > uCover*1.18 - .06) discard;
        float edge = vClear + (sn(vSnowW.xz*11.0)-.5)*.05;
        if (vClear > .001 && vUv.x < edge) discard;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.15,.19,.26)*uNight;`);
  };
  return m;
}

/* ================================================================== */
export async function createScene(canvas, opts = {}) {
  const tier = opts.tier || "high";
  const Q = {
    high: { dpr: 1.6, shadow: 2048, flakes: 9000, samples: 4, spray: 1600 },
    mid:  { dpr: 1.25, shadow: 1024, flakes: 5000, samples: 2, spray: 900 },
    low:  { dpr: 1, shadow: 512, flakes: 2500, samples: 0, spray: 400 }
  }[tier] || { dpr: 1.25, shadow: 1024, flakes: 5000, samples: 2, spray: 900 };
  const onStep = opts.onStep || (() => {});
  const yieldFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: !!window.__CAPTURE });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.dpr));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf3f7fa, 60, 160);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 400);
  const shared = { uCover: { value: 0 }, uNight: { value: 0 } };

  /* lumières */
  const hemi = new THREE.HemisphereLight(0xeaf2f8, 0x8d9aa6, 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4);
  sun.position.set(-30, 42, 26); sun.castShadow = true;
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 30, bottom: -30, near: 5, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);

  const M = {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x3a434c, roughness: .55, metalness: .05 }),
    asphaltLight: new THREE.MeshStandardMaterial({ color: 0x4c5660, roughness: .7 }),
    line: new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: .6 }),
    ground: new THREE.MeshStandardMaterial({ map: speckleTexture(), roughness: .96 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 1 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xc7dbe8, roughness: .28, metalness: .05 }),
    plinth: new THREE.MeshStandardMaterial({ color: 0x16242f, roughness: .6 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x4a525b, roughness: .85 }),
    flatRoof: new THREE.MeshStandardMaterial({ color: 0x6d7782, roughness: .9 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85 }),
    window: new THREE.MeshStandardMaterial({ color: 0x223140, emissive: 0xffc77a, emissiveIntensity: 0, roughness: .4 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xb9c2ca, roughness: .9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2c3742, roughness: .45, metalness: .6 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: .9 }),
    truckWhite: new THREE.MeshStandardMaterial({ color: 0xf1f4f6, roughness: .4, metalness: .15 }),
    truckBlue: new THREE.MeshStandardMaterial({ color: 0x2b74a8, roughness: .45, metalness: .2 }),
    loader: new THREE.MeshStandardMaterial({ color: 0xe0a92e, roughness: .5, metalness: .15 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2a36, roughness: .15, metalness: .4 }),
    beacon: new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff8a1e, emissiveIntensity: 0 }),
    head: new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1d0, emissiveIntensity: 0 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x3a4651, roughness: .6, metalness: .4 }),
    tree: new THREE.MeshStandardMaterial({ color: 0x2e4a3e, roughness: .9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x4a3b31, roughness: 1 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: .9 }),
    sign: new THREE.MeshStandardMaterial({ color: 0x2b74a8, emissive: 0x2b74a8, emissiveIntensity: 0, roughness: .5 }),
    sand: new THREE.MeshStandardMaterial({ color: 0xc9ab7a, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8c9399, roughness: 1 }),
    earth: new THREE.MeshStandardMaterial({ color: 0x4b3a2c, roughness: 1 }),
    salt: new THREE.MeshStandardMaterial({ color: 0xa8b4bd, roughness: .8 })
  };
  M.snow.onBeforeCompile = sh => { sh.uniforms.uNight = shared.uNight; sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uNight;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.15,.19,.26)*uNight;"); };
  M.ground.onBeforeCompile = M.snow.onBeforeCompile;
  const glowTex = radialTexture();

  const add = (geo, mat, x = 0, y = 0, z = 0, cast = true, receive = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive; scene.add(m); return m;
  };
  const flat = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);

  /* ---------- socle et île ---------- */
  const plinth = add(new THREE.BoxGeometry(66, 3.4, 47), [M.plinth, M.plinth, M.ice, M.plinth, M.plinth, M.plinth], 0, -2.2, 0, false, true);
  const labelGeo = new THREE.PlaneGeometry(56, 56 * 96 / 4096);
  const frontLabel = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: plinthLabel(["LAVAL (QC)", "45°34′ N · 73°41′ O", "RIVIÈRE DES PRAIRIES · MONTRÉAL", "GROUPE CLÉROUX"], 4096, 96), fog: false }));
  frontLabel.position.set(0, -1.4, 23.52); scene.add(frontLabel);
  const backLabel = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: plinthLabel(["RIVE-NORD", "RIVIÈRE DES MILLE ÎLES", "DÉNEIGEMENT · VRAC · PAYSAGER", "DEPUIS PLUS DE 40 ANS"], 4096, 96), fog: false }));
  backLabel.position.set(0, -1.4, -23.52); backLabel.rotation.y = Math.PI; scene.add(backLabel);

  const shape = new THREE.Shape();
  for (let i = 0; i <= 160; i++) { const th = i / 160 * Math.PI * 2, k = islandR(th); const x = Math.cos(th) * ISLAND.rx * k, z = Math.sin(th) * ISLAND.rz * k; i ? shape.lineTo(x, -z) : shape.moveTo(x, -z); }
  const islandGeo = new THREE.ExtrudeGeometry(shape, { depth: .55, bevelEnabled: true, bevelThickness: .12, bevelSize: .18, bevelSegments: 3, curveSegments: 1 });
  islandGeo.rotateX(-Math.PI / 2); islandGeo.translate(0, -.67, 0);
  // l'UV du dessus sert à la texture de neige
  { const pos = islandGeo.attributes.position, uv = islandGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 10, pos.getZ(i) / 10); }
  add(islandGeo, [M.ground, M.soil], 0, 0, 0, false, true);
  M.ground.map.repeat.set(1, 1);
  // ombre douce sous le socle, sur le « plancher du studio »
  const floor = add(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .16 }), 0, -3.9, 0, false, true);
  floor.material.transparent = true;
  onStep(.12); await yieldFrame();

  /* ---------- routes ---------- */
  const roadBase = [];
  const addRoad = (x1, z1, x2, z2, w, mat = M.asphalt) => {
    const L = Math.hypot(x2 - x1, z2 - z1); const g = flat(L + w * .0, w);
    const m = add(g, mat, (x1 + x2) / 2, .02, (z1 + z2) / 2, false, true);
    m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1); roadBase.push(m); return m;
  };
  addRoad(-25.6, 0, 25.6, 0, ROAD_W.blvd);
  addRoad(-20.6, 8, 22.6, 8, ROAD_W.street);
  addRoad(-22.6, -8, 22.6, -8, ROAD_W.street);
  AVENUES.forEach(x => addRoad(x, -8.6, x, 8.6, ROAD_W.avenue));
  // lignes du boulevard (rue Principale)
  for (let x = -24; x < 24; x += 1.6) add(flat(.7, .06), M.line, x, .032, 0, false, true);
  // prolongements vers les ponts (Montréal au sud, Rive-Nord au nord)
  const ezS = islandEdgeZ(-6, 1), ezN = islandEdgeZ(4, -1);
  addRoad(-6, 8, -6, ezS + .4, ROAD_W.avenue);
  addRoad(4, -8, 4, ezN - .4, ROAD_W.avenue);

  /* ponts */
  const bridge = (x, z0, z1) => {
    const L = Math.abs(z1 - z0), zc = (z0 + z1) / 2;
    add(new THREE.BoxGeometry(1.9, .28, L), M.concrete, x, -.13, zc, true, true);
    add(flat(1.3, L), M.asphaltLight, x, .02, zc, false, true);
    [-1, 1].forEach(s => add(new THREE.BoxGeometry(.07, .18, L), M.pole, x + s * .9, .1, zc, true, false));
    for (let z = Math.min(z0, z1) + 1.2; z < Math.max(z0, z1) - .6; z += 2.4) add(new THREE.BoxGeometry(.9, .9, .5), M.concrete, x, -.75, z, true, true);
  };
  bridge(-6, ezS, 23.5); bridge(4, ezN, -23.5);
  onStep(.22); await yieldFrame();

  /* ---------- neige sur les routes : tronçons, bancs de neige ---------- */
  const legs = [];          // tronçons dégagés par un véhicule
  const autoLegs = [];      // tronçons dégagés en fin de récit (ponts, cours des sites)
  const bankGeo = (L) => { const g = new THREE.BoxGeometry(L, .2, .3, Math.max(2, Math.ceil(L * 3)), 1, 2); g.translate(L / 2, .1, 0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) > .15) p.setY(i, .12 + Math.sin(p.getX(i) * 3.7) * .04 + Math.sin(p.getX(i) * 9.1) * .025); if (Math.abs(p.getZ(i)) > .1) p.setZ(i, p.getZ(i) * (.8 + Math.sin(p.getX(i) * 5.3) * .2)); }
    g.computeVertexNormals(); return g; };
  function makeCoverLeg(x1, z1, x2, z2, w, yo, banks) {
    const L = Math.hypot(x2 - x1, z2 - z1); if (L < .05) return null;
    const ang = Math.atan2(-(z2 - z1), x2 - x1);
    const g = new THREE.PlaneGeometry(L, w).rotateX(-Math.PI / 2); g.translate(L / 2, 0, 0);
    const mat = snowCoverMaterial(shared, false);
    const mesh = new THREE.Mesh(g, mat); mesh.position.set(x1, .05 + yo, z1); mesh.rotation.y = ang; mesh.receiveShadow = true; scene.add(mesh);
    const leg = { mesh, mat, L, clear: 0, banks: [] };
    if (banks) [-1, 1].forEach(s => { const b = new THREE.Mesh(bankGeo(L), M.snow); b.castShadow = true; b.receiveShadow = true;
      b.position.set(x1 + Math.sin(ang) * s * (w / 2 + .12), .0, z1 + Math.cos(ang) * s * (w / 2 + .12)); b.rotation.y = ang; b.scale.set(.0001, 1, 1); b.visible = false; scene.add(b); leg.banks.push(b); });
    return leg;
  }

  /* ---------- véhicules ---------- */
  const wheel = new THREE.CylinderGeometry(.11, .11, .09, 14).rotateX(Math.PI / 2);
  const bigWheel = new THREE.CylinderGeometry(.16, .16, .12, 14).rotateX(Math.PI / 2);
  function makeTruck(kind) {
    const g = new THREE.Group();
    const part = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    let beaconY, front;
    if (kind === "plow") {
      part(new THREE.BoxGeometry(1.32, .1, .46), M.steel, -.05, .16, 0);
      part(new THREE.BoxGeometry(.4, .36, .52), M.truckWhite, .4, .38, 0);
      part(new THREE.BoxGeometry(.06, .18, .44), M.glass, .61, .45, 0);
      part(new THREE.BoxGeometry(.4, .04, .53), M.truckBlue, .4, .25, 0);
      part(new THREE.BoxGeometry(.74, .34, .56), M.truckWhite, -.22, .4, 0);
      part(new THREE.BoxGeometry(.74, .05, .57), M.truckBlue, -.22, .25, 0);
      part(new THREE.BoxGeometry(.09, .24, .86), M.steel, .78, .14, 0, -.42);
      part(new THREE.BoxGeometry(.5, .08, .06), M.steel, -.1, .2, -.34, .12);
      [[.42, .26], [-.18, .26], [-.42, .26]].forEach(([x, z]) => { part(wheel, M.tire, x, .11, z); part(wheel, M.tire, x, .11, -z); });
      beaconY = .6; front = .62;
    } else {
      part(new THREE.BoxGeometry(.62, .3, .46), M.loader, -.12, .34, 0);
      part(new THREE.BoxGeometry(.3, .28, .4), M.glass, .06, .62, 0);
      part(new THREE.BoxGeometry(.32, .04, .44), M.loader, .06, .77, 0);
      part(new THREE.BoxGeometry(.32, .08, .08), M.loader, .38, .3, .15, 0);
      part(new THREE.BoxGeometry(.32, .08, .08), M.loader, .38, .3, -.15, 0);
      part(new THREE.BoxGeometry(.12, .28, .98), M.steel, .6, .16, 0);
      [[.2, .26], [-.32, .26]].forEach(([x, z]) => { part(bigWheel, M.tire, x, .16, z); part(bigWheel, M.tire, x, .16, -z); });
      beaconY = .82; front = .3;
    }
    const beacon = part(new THREE.BoxGeometry(.08, .05, .08), M.beacon.clone(), kind === "plow" ? .4 : .06, beaconY, 0); beacon.castShadow = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9230, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(1.4, 1.4, 1); glow.position.set(beacon.position.x, beaconY + .05, 0); g.add(glow);
    const heads = [-.16, .16].map(z => { const h = part(new THREE.BoxGeometry(.03, .05, .07), M.head, front, .3, z); h.castShadow = false; return h; });
    const pool = new THREE.Mesh(flat(2.2, 1.3), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff0d2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.set(front + 1.25, .05, 0); g.add(pool);
    const bpool = new THREE.Mesh(flat(3, 3), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff8a26, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    bpool.position.set(0, .06, 0); g.add(bpool);
    scene.add(g);
    return { g, beacon, glow, pool, bpool, heads, phase: R() * 6 };
  }

  const vehicles = ROUTES.map((r, idx) => {
    const v = { ...r, idx, model: makeTruck(r.kind), segs: [], total: 0, s: 0, prevS: 0, heading: 0, moving: 0 };
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i], [x2, z2] = r.pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1);
      const seg = { x1, z1, x2, z2, L, s0: v.total, s1: v.total + L, clear: !!r.clear[i], leg: null };
      if (seg.clear) { seg.leg = makeCoverLeg(x1, z1, x2, z2, r.w + (r.kind === "plow" ? .14 : 0), idx * .004, r.kind === "plow"); if (seg.leg) { seg.leg.vehicle = v; seg.leg.kind = r.kind; legs.push(seg.leg); } }
      v.segs.push(seg); v.total += L;
    }
    const [x0, z0] = r.pts[0], [xn, zn] = r.pts[1];
    v.heading = Math.atan2(-(zn - z0), xn - x0);
    v.model.g.position.set(x0, 0, z0); v.model.g.rotation.y = v.heading;
    return v;
  });
  const posAt = (v, s) => {
    s = clamp(s, 0, v.total);
    for (const sg of v.segs) if (s <= sg.s1 + 1e-6) { const t = sg.L ? (s - sg.s0) / sg.L : 0; return [lerp(sg.x1, sg.x2, t), lerp(sg.z1, sg.z2, t), sg]; }
    const l = v.segs[v.segs.length - 1]; return [l.x2, l.z2, l];
  };
  onStep(.36); await yieldFrame();

  /* ---------- prolongements et ponts : neige dégagée en fin de récit ---------- */
  [[-6, 8, -6, ezS + .3, ROAD_W.avenue, .80], [4, -8, 4, ezN - .3, ROAD_W.avenue, .81], [-6, ezS + .3, -6, 23.4, 1.3, .83], [4, ezN - .3, 4, -23.4, 1.3, .84]].forEach(([x1, z1, x2, z2, w, p0], i) => {
    const leg = makeCoverLeg(x1, z1, x2, z2, w, .04 + i * .003, false);
    autoLegs.push({ leg, p0, p1: p0 + .05 });
  });

  /* ---------- sites de Groupe Cléroux (2) ---------- */
  function depot(x0, x1, z0, z1, garage, extras) {
    const w = x1 - x0, d = z1 - z0;
    add(flat(w, d), M.asphaltLight, (x0 + x1) / 2, .02, (z0 + z1) / 2, false, true);
    const leg = makeCoverLeg(x0, (z0 + z1) / 2, x1, (z0 + z1) / 2, d, .005, false);
    autoLegs.push({ leg, p0: .38, p1: .46 });
    const [gx0, gx1, gz0, gz1, gh] = garage;
    add(new THREE.BoxGeometry(gx1 - gx0, gh, gz1 - gz0), M.concrete, (gx0 + gx1) / 2, gh / 2, (gz0 + gz1) / 2);
    const roof = add(new THREE.BoxGeometry(gx1 - gx0 + .1, .08, gz1 - gz0 + .1), M.flatRoof, (gx0 + gx1) / 2, gh + .04, (gz0 + gz1) / 2);
    roof.userData.snowRoof = true;
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(.05, gh * .62, (gz1 - gz0) / 3.8), M.steel, gx1 + .01, gh * .31, gz0 + (gz1 - gz0) * (i + .5) / 3, false, false);
    add(new THREE.BoxGeometry(.04, .14, (gz1 - gz0) * .8), M.sign, gx1 + .03, gh - .14, (gz0 + gz1) / 2, false, false);
    extras && extras();
  }
  function bumpy(g) { const q = g.attributes.position; for (let i = 0; i < q.count; i++) { const y = q.getY(i); if (y > .05) { const k = 1 + Math.sin(q.getX(i) * 7 + q.getZ(i) * 5) * .12 + Math.sin(q.getZ(i) * 13) * .06; q.setY(i, y * k); } } g.computeVertexNormals(); }
  const pile = (x, z, r, h, mat) => { const m = add(new THREE.ConeGeometry(r, h, 18, 1), mat, x, h / 2, z); m.scale.z = .8; return m; };
  depot(4.75, 13.25, -7.25, -.75, [4.9, 7.4, -7.1, -4.4, 1.5], () => {
    const dome = add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.salt, 5.95, 0, -2.4);
    dome.scale.set(1, .85, 1);
  });
  depot(-23.8, -16.75, .75, 7.25, [-23.6, -20.6, 1.0, 3.6, 1.35], () => {
    pile(-23.0, 5.4, .75, .75, M.sand); pile(-21.7, 5.9, .65, .62, M.stone); pile(-22.6, 6.7, .55, .5, M.earth);
  });
  // camions stationnés : la flotte qui attend
  const parked = [[12.4, -2.4, 0], [12.4, -4.2, 0], [12.4, -5.9, 0], [8.2, -3.7, Math.PI / 2], [9.6, -3.7, Math.PI / 2], [-19, 2.2, Math.PI], [-19, 4, Math.PI], [-17.9, 3.1, Math.PI]];
  const parkedTrucks = parked.map(([x, z, r], i) => { const t = makeTruck(i % 4 === 3 ? "loader" : "plow"); t.g.position.set(x, 0, z); t.g.rotation.y = r; return t; });
  onStep(.48); await yieldFrame();

  /* ---------- commerces et stationnements (le chargeur y travaille) ---------- */
  const lots = { N: [], S: [] };
  vehicles.filter(v => v.lot).forEach(v => v.segs.forEach(s => s.leg && lots[v.lot].push(s.leg)));
  [[-1, -1], [1, 1]].forEach(([sgn]) => {
    const zc = sgn * 3.28;
    add(flat(8.6, 4.3), M.asphalt, -1, .02, zc, false, true);
    for (let x = -4.6; x <= 2.8; x += .9) add(flat(.04, 1.1), M.line, x, .032, sgn * 1.9, false, true), add(flat(.04, 1.1), M.line, x, .032, sgn * 4.6, false, true);
    const bz = sgn * 6.6;
    add(new THREE.BoxGeometry(8.4, 1.25, 1.55), M.wall, -1, .625, bz).material = new THREE.MeshStandardMaterial({ color: 0xdde5ec, roughness: .8 });
    const r = add(new THREE.BoxGeometry(8.5, .08, 1.65), M.flatRoof, -1, 1.29, bz); r.userData.snowRoof = true;
    add(new THREE.BoxGeometry(6.2, .16, .04), M.sign, -1, 1.02, bz - sgn * .8, false, false);
    for (let x = -4.4; x < 2.6; x += .7) { const wnd = add(new THREE.PlaneGeometry(.42, .38), M.window, x, .38, bz - sgn * .79, false, false); wnd.rotation.y = sgn > 0 ? Math.PI : 0; }
    // poteaux d'éclairage du stationnement
    [-3, 1].forEach(x => { add(new THREE.CylinderGeometry(.03, .03, 1.3, 6), M.pole, x, .65, zc); });
    // amoncellements de neige aux extrémités du stationnement
    [-5.7, 3.7].forEach(x => { const p = add(new THREE.SphereGeometry(.9, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.snow, x, 0, zc); p.scale.set(.75, .0001, 1.7); bumpy(p.geometry); p.visible = false; (lots[sgn < 0 ? "N" : "S"].piles ||= []).push(p); });
  });

  /* ---------- quartiers résidentiels ---------- */
  const houseSpots = [];
  const zoneBlocked = (x, side, street) => {
    if (AVENUES.some(a => Math.abs(x - a) < 1.75)) return true;
    if (x > -6.8 && x < 4.8 && side === "in") return true;                  // commerces
    if (street < 0 && side === "in" && x > 4.2 && x < 13.8) return true;   // site 1
    if (street > 0 && side === "in" && x < -16.2) return true;             // site 2
    if (Math.abs(x - (street > 0 ? -6 : 4)) < 1.9 && side === "out") return true; // vers les ponts
    return false;
  };
  [-8, 8].forEach(street => ["in", "out"].forEach(side => {
    const dir = (side === "in" ? -1 : 1) * Math.sign(street);  // vers où se trouve la maison
    for (let x = -22.6; x <= 22.6; x += 2.35) {
      const zH = street + dir * 3.05;
      if (zoneBlocked(x, side, street)) continue;
      if (!insideIsland(x, zH + dir * 1.2, .6) || !insideIsland(x - 1, zH, .6) || !insideIsland(x + 1, zH, .6)) continue;
      houseSpots.push({ x: x + (R() - .5) * .25, zH, dir, street });
    }
  }));
  const NH = houseSpots.length;
  const wallsI = new THREE.InstancedMesh(new THREE.BoxGeometry(1.55, .8, 1.45), M.wall, NH);
  const roofGeo = new THREE.CylinderGeometry(.98, .98, 1.72, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2); roofGeo.scale(1, .5, 1);
  const roofsI = new THREE.InstancedMesh(roofGeo, M.roof, NH);
  const winI = new THREE.InstancedMesh(new THREE.PlaneGeometry(.22, .2), M.window, NH * 3);
  const chimI = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, .4, .16), M.concrete, NH);
  const driveBase = new THREE.InstancedMesh(flat(1, 1), M.asphaltLight, NH);
  const dCover = snowCoverMaterial(shared, true);
  const driveGeo = flat(1, 1); driveGeo.translate(0, 0, 0);
  // l'UV.x de l'entrée part de la rue et va vers la maison
  const driveCover = new THREE.InstancedMesh(driveGeo, dCover, NH);
  const aClear = new THREE.InstancedBufferAttribute(new Float32Array(NH), 1); aClear.setUsage(THREE.DynamicDrawUsage);
  driveCover.geometry.setAttribute("aClear", aClear);
  const siding = [0xdfe5ea, 0xbfcad3, 0x8e6e5f, 0xe9e1d6, 0x5d6b78, 0xa9b6bf, 0x7d8f86, 0xf2efe9];
  const o = new THREE.Object3D(), col = new THREE.Color();
  const drives = [];
  houseSpots.forEach((h, i) => {
    const face = h.dir > 0 ? Math.PI : 0;   // façade vers la rue
    o.position.set(h.x, .4, h.zH); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); wallsI.setMatrixAt(i, o.matrix);
    wallsI.setColorAt(i, col.set(siding[Math.floor(R() * siding.length)]));
    o.position.set(h.x, .8 + .245, h.zH); o.rotation.set(0, 0, 0); o.updateMatrix(); roofsI.setMatrixAt(i, o.matrix);
    o.position.set(h.x + .45, 1.15, h.zH + (R() - .5) * .5); o.rotation.set(0, 0, 0); o.updateMatrix(); chimI.setMatrixAt(i, o.matrix);
    const fz = h.zH - h.dir * .726;
    [[-.52, .46], [-.12, .46], [.25, .46]].forEach(([dx, y], k) => { o.position.set(h.x + dx, y, fz); o.rotation.set(0, face, 0); o.updateMatrix(); winI.setMatrixAt(i * 3 + k, o.matrix); });
    // entrée de garage : de la bordure de rue jusqu'à la maison
    const z0 = h.street + h.dir * (ROAD_W.street / 2), z1 = h.zH - h.dir * .72, L = Math.abs(z1 - z0), xD = h.x + .48;
    o.position.set(xD, .02, (z0 + z1) / 2); o.rotation.set(0, 0, 0); o.scale.set(.62, 1, L); o.updateMatrix(); driveBase.setMatrixAt(i, o.matrix);
    o.position.set(xD, .045, (z0 + z1) / 2); o.rotation.set(0, h.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); o.scale.set(L, 1, .62); o.updateMatrix(); driveCover.setMatrixAt(i, o.matrix);
    drives.push({ x: xD, street: h.street, clear: 0, sAt: null, v: null });
  });
  [wallsI, roofsI, chimI].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  [winI, driveBase, driveCover].forEach(m => { m.receiveShadow = true; scene.add(m); });
  wallsI.instanceColor.needsUpdate = true;
  // à quel moment chaque entrée est dégagée : quand la déneigeuse de sa rue passe devant
  drives.forEach(d => {
    for (const v of vehicles) for (const sg of v.segs) {
      if (!sg.clear || sg.z1 !== d.street || sg.z2 !== d.street) continue;
      const lo = Math.min(sg.x1, sg.x2), hi = Math.max(sg.x1, sg.x2);
      if (d.x >= lo && d.x <= hi) { d.v = v; d.sAt = sg.s0 + Math.abs(d.x - sg.x1); }
    }
  });
  onStep(.62); await yieldFrame();

  /* ---------- arbres ---------- */
  const trees = [];
  const nearRoad = (x, z, m) => Math.abs(z) < ROAD_W.blvd / 2 + m || Math.abs(Math.abs(z) - 8) < ROAD_W.street / 2 + m || AVENUES.some(a => Math.abs(x - a) < ROAD_W.avenue / 2 + m && Math.abs(z) < 8.6) || (Math.abs(x + 6) < 1.2 && z > 8) || (Math.abs(x - 4) < 1.2 && z < -8);
  const nearStuff = (x, z) => houseSpots.some(h => Math.abs(x - h.x) < 1.25 && Math.abs(z - h.zH) < 1.15) || (x > -6.8 && x < 4.8 && Math.abs(z) < 7.6) || (x > 4.4 && x < 13.6 && z < -.4 && z > -7.6) || (x < -16.4 && z > .4 && z < 7.6);
  let tries = 0;
  while (trees.length < (tier === "high" ? 190 : 130) && tries++ < 9000) {
    const x = (R() * 2 - 1) * 28, z = (R() * 2 - 1) * 17.5;
    if (!insideIsland(x, z, .8) || nearRoad(x, z, .55) || nearStuff(x, z)) continue;
    trees.push([x, z, .7 + R() * .6]);
  }
  const coneI = new THREE.InstancedMesh(new THREE.ConeGeometry(.42, 1.25, 7), M.tree, trees.length);
  const cone2I = new THREE.InstancedMesh(new THREE.ConeGeometry(.32, .9, 7), M.tree, trees.length);
  const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .07, .35, 5), M.trunk, trees.length);
  trees.forEach(([x, z, s], i) => {
    o.rotation.set(0, R() * 6, 0); o.scale.set(s, s, s);
    o.position.set(x, .35 * s + .62 * s, z); o.updateMatrix(); coneI.setMatrixAt(i, o.matrix);
    o.position.set(x, .35 * s + 1.12 * s, z); o.updateMatrix(); cone2I.setMatrixAt(i, o.matrix);
    o.position.set(x, .175 * s, z); o.updateMatrix(); trunkI.setMatrixAt(i, o.matrix);
  });
  [coneI, cone2I, trunkI].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

  /* ---------- lampadaires ---------- */
  const lampSpots = [];
  for (let x = -23; x <= 23; x += 4.6) { lampSpots.push([x, -1.45]); lampSpots.push([x + 2.3, 1.45]); }
  for (let x = -19; x <= 21; x += 5.2) { lampSpots.push([x, -8.95]); lampSpots.push([x + 2.6, 8.95]); }
  const lampOK = lampSpots.filter(([x, z]) => insideIsland(x, z, .5) && !AVENUES.some(a => Math.abs(x - a) < 1.2) && !(x > -6.8 && x < 4.8 && Math.abs(z) < 2));
  const poleI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .03, 1.05, 5), M.pole, lampOK.length);
  const headI = new THREE.InstancedMesh(new THREE.BoxGeometry(.16, .05, .1), M.lamp, lampOK.length);
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffd8a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolI = new THREE.InstancedMesh(flat(1.9, 1.9), poolMat, lampOK.length);
  lampOK.forEach(([x, z], i) => {
    o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    o.position.set(x, .525, z); o.updateMatrix(); poleI.setMatrixAt(i, o.matrix);
    o.position.set(x, 1.05, z - Math.sign(z) * .06); o.updateMatrix(); headI.setMatrixAt(i, o.matrix);
    o.position.set(x, .03, z - Math.sign(z) * .5); o.updateMatrix(); poolI.setMatrixAt(i, o.matrix);
  });
  poleI.castShadow = true; scene.add(poleI, headI, poolI);
  onStep(.74); await yieldFrame();

  /* ---------- neige qui tombe ---------- */
  const NF = Q.flakes;
  const fGeo = new THREE.BufferGeometry();
  const fp = new Float32Array(NF * 3), fs = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { fp[i * 3] = (R() * 2 - 1) * 40; fp[i * 3 + 1] = R() * 26; fp[i * 3 + 2] = (R() * 2 - 1) * 30; fs[i] = R(); }
  fGeo.setAttribute("position", new THREE.BufferAttribute(fp, 3)); fGeo.setAttribute("aSeed", new THREE.BufferAttribute(fs, 1));
  const flakeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uWind: { value: .3 }, uAmount: { value: .2 }, uNight: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `attribute float aSeed; uniform float uTime, uWind, uScale; varying float vA; varying float vS;
      void main(){ vec3 p = position; float sp = .9 + aSeed*1.4;
        p.y = mod(p.y - uTime*sp*1.6, 26.0) - 1.0;
        p.x = mod(p.x + uTime*uWind*(3.0+aSeed*2.0) + sin(uTime*.7+aSeed*40.)*.6 + 40.0, 80.0) - 40.0;
        p.z += cos(uTime*.5+aSeed*30.)*.5;
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv;
        float s = (.5 + aSeed*1.2); gl_PointSize = s * uScale / -mv.z; vS = aSeed;
        vA = smoothstep(-1.0, 2.0, p.y) * smoothstep(240.0, 30.0, -mv.z); }`,
    fragmentShader: `uniform float uAmount, uNight; varying float vA; varying float vS;
      void main(){ vec2 c = gl_PointCoord-.5; float d = length(c); if (d>.5) discard;
        float a = smoothstep(.5,.1,d) * vA * clamp(uAmount*1.25 - vS*.25, 0.0, 1.0);
        vec3 col = mix(vec3(1.0), vec3(.82,.88,.95), uNight);
        gl_FragColor = vec4(col, a*.95); }`
  });
  const flakes = new THREE.Points(fGeo, flakeMat); flakes.frustumCulled = false; scene.add(flakes);

  /* ---------- gerbe de neige projetée par la lame ---------- */
  const NS = Q.spray;
  const sGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3), sl = new Float32Array(NS);
  for (let i = 0; i < NS; i++) sp[i * 3 + 1] = -50;
  sGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3)); sGeo.setAttribute("aLife", new THREE.BufferAttribute(sl, 1));
  const sprayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uScale: { value: 300 }, uNight: { value: 0 } },
    vertexShader: `attribute float aLife; uniform float uScale; varying float vL; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (0.35 + aLife*.5) * uScale / -mv.z * .5; vL = aLife; }`,
    fragmentShader: `uniform float uNight; varying float vL; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); if(d>.5) discard; gl_FragColor = vec4(mix(vec3(1.0),vec3(.86,.9,.95),uNight), smoothstep(.5,.0,d)*vL*.9); }`
  });
  const spray = new THREE.Points(sGeo, sprayMat); spray.frustumCulled = false; scene.add(spray);
  let sprayHead = 0;
  const emit = (x, y, z, vx, vy, vz) => { const i = sprayHead; sprayHead = (sprayHead + 1) % NS; sp[i * 3] = x; sp[i * 3 + 1] = y; sp[i * 3 + 2] = z; sv[i * 3] = vx; sv[i * 3 + 1] = vy; sv[i * 3 + 2] = vz; sl[i] = 1; };
  onStep(.84); await yieldFrame();

  /* ---------- post-traitement : effet maquette (flou de profondeur « tilt-shift ») ---------- */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.samples, colorSpace: THREE.LinearSRGBColorSpace });
  const post = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: .5 }, uBand: { value: .13 }, uAmount: { value: 1 },
      uTime: { value: 0 }, uGrain: { value: .035 }, uSat: { value: 1.12 }, uVig: { value: .22 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uAmount, uTime, uGrain, uSat, uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        float d = abs(vUv.y - uFocus);
        float b = smoothstep(uBand, uBand + .34, d) * uAmount;
        vec3 acc = texture2D(tDiffuse, vUv).rgb; float wsum = 1.0;
        float rad = b * 9.0;
        if (rad > .25) {
          for (int i = 0; i < 20; i++) {
            float fi = float(i); float r = sqrt((fi + .5) / 20.0) * rad; float a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * r / uRes;
            acc += texture2D(tDiffuse, vUv + o).rgb; wsum += 1.0;
          }
        }
        vec3 col = acc / wsum;
        float l = dot(col, vec3(.2126,.7152,.0722)); col = mix(vec3(l), col, uSat);
        vec2 q = vUv - .5; col *= 1.0 - dot(q, q) * uVig;
        col += (h(vUv * uRes + uTime) - .5) * uGrain * .5;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  post.toneMapped = true;
  if (window.__CAPTURE) post.uniforms.uGrain.value = 0;
  const postScene = new THREE.Scene(); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  // le rendu de la scène va dans une cible linéaire : le mappage de tons se fait une seule fois, dans la passe finale
  const C = { dayTop: new THREE.Color("#e7eef4"), dayBot: new THREE.Color("#f6f9fb"), nightTop: new THREE.Color("#2b4057"), nightBot: new THREE.Color("#6a8197"),
    dawnTop: new THREE.Color("#a9bfd2"), dawnBot: new THREE.Color("#f1d3bd"), sunDay: new THREE.Color("#fff6ea"), hemiDay: new THREE.Color("#eaf2f8"), hemiNight: new THREE.Color("#8ea4bf"), sunDawn: new THREE.Color("#ffb37a"), sunNight: new THREE.Color("#8aa2c0") };
  const bg = new THREE.Color(), bgTop = new THREE.Color();
  // fond en dégradé : une sphère inversée qui suit la caméra
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop, uBot; varying vec3 vW; void main(){ float t = smoothstep(-.25, .65, vW.y); gl_FragColor = vec4(mix(uBot, uTop, t), 1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat); sky.renderOrder = -1; scene.add(sky);
  onStep(.94); await yieldFrame();

  /* ---------- état et mise à jour ---------- */
  const state = { p: 0, ps: 0, t: 0, intro: window.__CAPTURE ? 0 : 1, introT: 0, px: 0, py: 0, pxs: 0, pys: 0, w: 1, h: 1, running: false, lastNow: 0, stats: {} };
  const roofCol = new THREE.Color(0x4a525b), flatRoofCol = new THREE.Color(0x6d7782), snowCol = new THREE.Color(0xf1f5f9), treeCol = new THREE.Color(0x2e4a3e), treeSnow = new THREE.Color(0xa9bcbe);
  const camPos = new THREE.CatmullRomCurve3(CAM.map(k => new THREE.Vector3(...k.pos)), false, "centripetal");
  const camTgt = new THREE.CatmullRomCurve3(CAM.map(k => new THREE.Vector3(...k.tgt)), false, "centripetal");
  const tmpV = new THREE.Vector3(), tmpT = new THREE.Vector3(), right = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0);
  function camU(p) {
    for (let i = 1; i < CAM.length; i++) if (p <= CAM[i].p) { const t = (p - CAM[i - 1].p) / (CAM[i].p - CAM[i - 1].p); const e = t * t * (3 - 2 * t); return { u: (i - 1 + e) / (CAM.length - 1), focus: lerp(CAM[i - 1].focus, CAM[i].focus, e) }; }
    return { u: 1, focus: CAM[CAM.length - 1].focus };
  }

  function update(dt) {
    const p = state.ps;
    state.t += dt;
    const t = state.t;
    const snow = A.snow(p), cover = A.cover(p), dark = A.dark(p), warm = A.warm(p), beaconOn = A.beacon(p);
    shared.uCover.value = cover; shared.uNight.value = dark;

    // ciel, brouillard, lumière
    bgTop.copy(C.dayTop).lerp(C.nightTop, dark).lerp(C.dawnTop, warm * .55 * (1 - dark));
    bg.copy(C.dayBot).lerp(C.nightBot, dark).lerp(C.dawnBot, warm * .7 * (1 - dark * .6));
    skyMat.uniforms.uTop.value.copy(bgTop); skyMat.uniforms.uBot.value.copy(bg);
    scene.fog.color.copy(bg).lerp(bgTop, .35);
    scene.fog.near = lerp(70, 22, snow * .9); scene.fog.far = lerp(190, 95, snow);
    sun.intensity = lerp(2.6, .55, dark) * (1 - snow * .3) + warm * .6;
    sun.color.copy(C.sunDay).lerp(C.sunNight, dark).lerp(C.sunDawn, warm * (1 - dark));
    const sunAng = lerp(.35, -.55, smooth(.72, 1, p));
    sun.position.set(-30 + Math.sin(sunAng) * 14, lerp(42, 22, warm) , 26 + Math.cos(sunAng) * 6);
    hemi.intensity = lerp(1.7, .95, dark) - snow * .12;
    hemi.color.copy(C.hemiDay).lerp(C.hemiNight, dark);
    const lampI = smooth(.15, .4, dark);
    M.lamp.emissiveIntensity = lampI * 3; poolMat.opacity = lampI * .28;
    M.window.emissiveIntensity = lampI * 1.4 + .05;
    M.sign.emissiveIntensity = lampI * .9;

    // neige accumulée sur les toits et les arbres
    M.roof.color.copy(roofCol).lerp(snowCol, smooth(.02, .7, cover));
    M.flatRoof.color.copy(flatRoofCol).lerp(snowCol, smooth(.02, .6, cover));
    M.tree.color.copy(treeCol).lerp(treeSnow, smooth(.1, 1, cover) * .7);

    // flocons
    flakeMat.uniforms.uTime.value = t; flakeMat.uniforms.uAmount.value = snow; flakeMat.uniforms.uWind.value = A.wind(p) * 1.2; flakeMat.uniforms.uNight.value = dark;
    flakes.visible = snow > .01;
    sprayMat.uniforms.uNight.value = dark;

    // véhicules
    let cleared = 0, clearedMax = 0;
    for (const v of vehicles) {
      const k = clamp((p - v.p[0]) / (v.p[1] - v.p[0]));
      v.prevS = v.s; v.s = k * v.total;
      const [x, z, sg] = posAt(v, v.s);
      const [xa, za] = posAt(v, Math.min(v.total, v.s + .35));
      const dx = xa - x, dz = za - z;
      if (Math.hypot(dx, dz) > 1e-4) { const target = Math.atan2(-dz, dx); v.heading = lerpAngle(v.heading, target, clamp(dt * 7)); }
      const g = v.model.g; g.position.set(x, 0, z); g.rotation.y = v.heading;
      const speed = Math.abs(v.s - v.prevS) / Math.max(dt, 1e-3);
      v.moving = lerp(v.moving, clamp(speed / 3), clamp(dt * 5));
      g.position.y = Math.sin(t * 22 + v.model.phase) * .006 * v.moving;
      // tronçons dégagés
      for (const s of v.segs) if (s.leg) {
        const c = clamp((v.s - s.s0) / s.L);
        s.leg.clear = c; s.leg.mat.userData.uClear.value = c > 0 ? Math.max(c, .002) : 0;
        s.leg.banks.forEach(b => { b.visible = c > .002; b.scale.x = Math.max(.0001, c); b.scale.y = .6 + cover * .5; });
      }
      // lumières du véhicule
      const flash = beaconOn * (.25 + .75 * Math.pow(Math.max(0, Math.sin(t * 7.5 + v.model.phase)), 6) + .5 * Math.pow(Math.max(0, Math.sin(t * 7.5 + v.model.phase + .6)), 10));
      v.model.beacon.material.emissiveIntensity = flash * 6;
      v.model.glow.material.opacity = flash * .9;
      v.model.bpool.material.opacity = flash * .35 * (.4 + dark * .6);
      const hl = smooth(.2, .5, dark) * (beaconOn > .1 ? 1 : .2);
      v.model.pool.material.opacity = hl * .5;
      // gerbe de neige
      const onClear = sg && sg.clear && v.s > 0 && v.s < v.total;
      if (onClear && speed > .05 && dt > 0) {
        const n = Math.min(14, Math.round(speed * dt * 60 * (v.kind === "plow" ? 1.4 : .9)));
        const c = Math.cos(v.heading), s = Math.sin(v.heading);
        const fx = c, fz = -s, rx = -s * -1, rz = -c * -1; // droite du véhicule
        for (let i = 0; i < n; i++) {
          const side = v.kind === "plow" ? 1 : (i % 2 ? 1 : -1);
          const ox = x + fx * (v.kind === "plow" ? .78 : .62) + rx * side * (.38 + R() * .1), oz = z + fz * (v.kind === "plow" ? .78 : .62) + rz * side * (.38 + R() * .1);
          const sp_ = .8 + R() * 1.1;
          emit(ox, .2 + R() * .1, oz, rx * side * sp_ * 1.3 + fx * .6 * R(), .9 + R() * 1.4, rz * side * sp_ * 1.3 + fz * .6 * R());
        }
      }
    }
    M.head.emissiveIntensity = smooth(.2, .5, dark) * 3;
    for (const lg of legs) if (lg.kind === "plow") { clearedMax += lg.L; cleared += lg.L * lg.clear; }
    for (const a of autoLegs) { const c = smooth(a.p0, a.p1, p); a.leg.mat.userData.uClear.value = c > 0 ? Math.max(c, .002) : 0; }

    // entrées résidentielles
    let dClear = 0;
    drives.forEach((d, i) => {
      let c = 0;
      if (d.v) c = clamp((d.v.s - d.sAt + .2) / 1.1);
      else c = smooth(.8, .86, p);
      d.clear = c; aClear.array[i] = c > 0 ? Math.max(c, .002) : 0; if (c > .98) dClear++;
    });
    aClear.needsUpdate = true;

    // stationnements
    const lotPct = {};
    ["N", "S"].forEach(k => { const L = lots[k]; const avg = L.reduce((a, l) => a + l.clear, 0) / L.length; lotPct[k] = avg;
      (L.piles || []).forEach(pl => { pl.visible = avg > .01; pl.scale.y = Math.max(.0001, avg * .42); }); });

    // gerbe : physique simple
    for (let i = 0; i < NS; i++) {
      if (sl[i] <= 0) continue;
      sl[i] -= dt * 1.25;
      sv[i * 3 + 1] -= 4.2 * dt;
      sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
      if (sp[i * 3 + 1] < .03) { sp[i * 3 + 1] = .03; sv[i * 3] *= .5; sv[i * 3 + 2] *= .5; sv[i * 3 + 1] = 0; sl[i] -= dt * 2; }
      if (sl[i] <= 0) sp[i * 3 + 1] = -50;
    }
    sGeo.attributes.position.needsUpdate = true; sGeo.attributes.aLife.needsUpdate = true;

    // caméra
    const { u, focus } = camU(p);
    camPos.getPoint(u, tmpV); camTgt.getPoint(u, tmpT);
    const aspect = state.w / state.h;
    const fit = aspect < 1 ? lerp(1, 1.85, clamp((1 - aspect) / .45)) : (aspect < 1.4 ? lerp(1.18, 1, (aspect - 1) / .4) : 1);
    tmpV.sub(tmpT).multiplyScalar(fit * (1 + state.intro * .55)).add(tmpT);
    tmpV.y += state.intro * 10;
    // la souris déplace légèrement le point de vue (effet de profondeur)
    state.pxs = lerp(state.pxs, state.px, clamp(dt * 2.2)); state.pys = lerp(state.pys, state.py, clamp(dt * 2.2));
    right.subVectors(tmpV, tmpT).cross(upV).normalize();
    const dist = tmpV.distanceTo(tmpT);
    tmpV.addScaledVector(right, state.pxs * dist * .035); tmpV.y += -state.pys * dist * .022;
    camera.position.copy(tmpV); camera.lookAt(tmpT);
    if (aspect < 1) { const k = 1 - smooth(.06, .14, p); camera.lookAt(tmpT.x - 3 * k, tmpT.y + 9 * k, tmpT.z + 3 * k); }
    sky.position.copy(camera.position);
    sun.target.position.set(0, 0, 0);

    post.uniforms.uFocus.value = focus - (aspect < 1 ? .2 * (1 - smooth(.06, .14, p)) : 0);
    post.uniforms.uAmount.value = A.blur(p) * (1 + state.intro * 1.8);
    post.uniforms.uTime.value = (t * 60) % 1000;

    state.stats = { snow, cover, dark, p, streets: clearedMax ? cleared / clearedMax : 0, drives: dClear, drivesMax: drives.length, lots: (lotPct.N + lotPct.S) / 2, engine: vehicles.reduce((a, v) => a + v.moving, 0) / vehicles.length };
  }

  function render() {
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }

  function resize() {
    const r = canvas.getBoundingClientRect(); const w = Math.max(2, r.width), h = Math.max(2, r.height);
    state.w = w; state.h = h;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
    post.uniforms.uRes.value.set(w * pr, h * pr);
    camera.aspect = w / h; camera.fov = w / h < 1 ? 38 : 30; camera.updateProjectionMatrix();
    const scale = h * pr / (2 * Math.tan(camera.fov * Math.PI / 360)) * .06;
    flakeMat.uniforms.uScale.value = scale; sprayMat.uniforms.uScale.value = scale * 1.6;
  }

  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - (state.lastNow || now)) / 1000); state.lastNow = now;
    state.ps = lerp(state.ps, state.p, clamp(dt * 3.2));
    if (Math.abs(state.ps - state.p) < .00005) state.ps = state.p;
    if (state.intro > 0) { state.introT += dt; state.intro = Math.max(0, 1 - smooth(0, 1, state.introT / 3.2)); }
    update(dt); render();
    opts.onFrame && opts.onFrame(state.stats);
  }

  resize(); update(0); render();
  onStep(1);

  return {
    tier,
    setProgress(p) { state.p = clamp(p); },
    setPointer(x, y) { state.px = x; state.py = y; },
    playIntro() { state.intro = 1; state.introT = 0; },
    skipIntro() { state.intro = 0; },
    start() { if (state.running) return; state.running = true; state.lastNow = 0; raf = requestAnimationFrame(frame); },
    stop() { state.running = false; cancelAnimationFrame(raf); },
    resize,
    get stats() { return state.stats; },
    // rendu image par image (enregistrement de la vidéo cellulaire)
    captureFrame(p, dt = 1 / 24) { state.p = state.ps = clamp(p); state.intro = 0; update(dt); render(); return state.stats; },
    renderer
  };
}

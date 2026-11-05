/* Petites maquettes 3D des pages services, dans le même langage que le diorama de Laval :
   « vrac » : un camion 10 roues qui décharge, entouré des piles de matériaux;
   « paysager » : une cour en été (pelouse tondue, haie, plates-bandes, pavé uni, arbre). */
import * as THREE from "./vendor/three.module.min.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export function mountSpecimen(canvas, kind, opts = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { canvas.classList.add("no-webgl"); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, opts.mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .5, 200);
  scene.add(new THREE.HemisphereLight(0xf2f6fa, 0x9aa6b0, 1.7));
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.6); sun.position.set(-8, 14, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(opts.mobile ? 1024 : 2048, opts.mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sun.shadow.bias = -.0005; sun.shadow.radius = 4;
  scene.add(sun);
  const std = (c, r = .9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const root = new THREE.Group(); scene.add(root);
  const add = (geo, mat, x, y, z, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

  // socle commun
  const plinthMat = std(0x16242f, .6);
  add(new THREE.BoxGeometry(10, 1.2, 10), plinthMat, 0, -.6, 0);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .12 }));
  shadowFloor.position.y = -1.2; shadowFloor.receiveShadow = true; scene.add(shadowFloor);

  const anim = [];
  if (kind === "vrac") {
    add(new THREE.BoxGeometry(9.8, .08, 9.8), std(0xa29c93, .95), 0, .04, 0);         // cour de gravier
    const pileGeo = (r, h) => { const g = new THREE.ConeGeometry(r, h, 28, 6); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < h / 2 - .01) { const k = 1 + Math.sin(p.getX(i) * 6 + p.getZ(i) * 4) * .05; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
      g.computeVertexNormals(); g.translate(0, h / 2, 0); return g; };
    const piles = [
      [-2.6, -2.4, 1.5, 1.3, 0x4b3a2c, "Top soil"], [.2, -2.9, 1.3, 1.1, 0x7d6a55, "Terre mixte"], [2.8, -2.2, 1.35, 1.05, 0x5a3a24, "Paillis"],
      [-3, .6, 1.2, .95, 0x8c9399, "Pierre 3/4 net"], [-2.7, 3.1, 1.1, .8, 0xb9b0a1, "Pierre de rivière"], [3.1, 2.9, 1.0, .75, 0xc9ab7a, "Sable"]
    ];
    piles.forEach(([x, z, r, h, c], i) => { const m = add(pileGeo(r, h), std(c, 1), x, .08, z); m.scale.y = 1; anim.push({ type: "pile", m, i }); });
    // camion 10 roues à benne
    const truck = new THREE.Group(); truck.position.set(1.2, .08, .8); truck.rotation.y = -Math.PI / 5; root.add(truck);
    const white = std(0xf1f4f6, .4, .15), blue = std(0x2b74a8, .45, .2), steel = std(0x2c3742, .45, .6), tire = std(0x15191d, .9), glass = std(0x1b2a36, .15, .4);
    add(new THREE.BoxGeometry(3.4, .26, 1.1), steel, 0, .42, 0, truck);
    add(new THREE.BoxGeometry(1, .9, 1.2), white, 1.3, 1.0, 0, truck);
    add(new THREE.BoxGeometry(.06, .42, 1.06), glass, 1.81, 1.18, 0, truck);
    add(new THREE.BoxGeometry(1.02, .1, 1.22), blue, 1.3, .62, 0, truck);
    const wheel = new THREE.CylinderGeometry(.27, .27, .2, 18).rotateX(Math.PI / 2);
    [[1.2, .62], [-.5, .62], [-1.15, .62]].forEach(([x, z]) => { add(wheel, tire, x, .27, z, truck); add(wheel, tire, x, .27, -z, truck); });
    const dumpPivot = new THREE.Group(); dumpPivot.position.set(-1.62, .6, 0); truck.add(dumpPivot);
    const dump = add(new THREE.BoxGeometry(2.3, .8, 1.25), white, 1.15, .4, 0, dumpPivot);
    add(new THREE.BoxGeometry(2.32, .1, 1.27), blue, 1.15, .06, 0, dumpPivot);
    const load = add(new THREE.BoxGeometry(2.1, .3, 1.1), std(0x4b3a2c, 1), 1.15, .72, 0, dumpPivot);
    const beacon = add(new THREE.BoxGeometry(.16, .1, .16), new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff8a1e, emissiveIntensity: 2 }), 1.3, 1.5, 0, truck);
    // flot de terre qui tombe de la benne
    const N = 380, pos = new Float32Array(N * 3), seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = Math.random();
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const fall = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0x4b3a2c, size: .07, sizeAttenuation: true }));
    truck.add(fall);
    const heap = add(pileGeo(.95, .7), std(0x4b3a2c, 1), -2.35, .0, 0, truck); heap.scale.set(1, .001, 1);
    anim.push({ type: "truck", dumpPivot, load, fall, pos, seeds, N, heap, beacon });
  } else {
    // pelouse avec bandes de tonte
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#6f9a5b" : "#7fa96a"; g.fillRect(0, i * 32, 512, 32); }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 50},${40 + Math.random() * 30},.35)`; g.fillRect(Math.random() * 512, Math.random() * 512, 1, 2 + Math.random() * 2); }
    const lawnTex = new THREE.CanvasTexture(c); lawnTex.colorSpace = THREE.SRGBColorSpace;
    const lawn = add(new THREE.BoxGeometry(9.8, .14, 9.8), new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 1 }), 0, .07, 0);
    // pavé uni : patio
    const paverA = std(0xb8b0a4, .85), paverB = std(0xa59d90, .85);
    for (let x = 0; x < 7; x++) for (let z = 0; z < 6; z++) add(new THREE.BoxGeometry(.48, .06, .48), (x + z) % 2 ? paverA : paverB, -4.3 + .62 + x * .5, .17, 1.4 + z * .5);
    // entrée en pavé uni
    for (let z = 0; z < 9; z++) add(new THREE.BoxGeometry(1.4, .06, .46), z % 2 ? paverA : paverB, 3.6, .17, -4.4 + .5 + z * .5);
    // coin de maison
    add(new THREE.BoxGeometry(4.2, 2.2, 2.4), std(0xe3e6e3, .85), -2.6, 1.24, -3.6);
    const roofG = new THREE.CylinderGeometry(1.6, 1.6, 4.5, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2); roofG.scale(1, .55, 1);
    add(roofG, std(0x3c444d, .8), -2.6, 2.34 + .44, -3.6);
    // haie taillée
    const hedgeMat = std(0x3e5f3c, .95);
    for (let i = 0; i < 9; i++) { const h = add(new THREE.BoxGeometry(.95, .75, .7), hedgeMat, -4.2 + .48 + i * .98, .52, 4.5); h.scale.y = 1; anim.push({ type: "hedge", m: h, i }); }
    // plates-bandes : terre, paillis et fleurs
    const bed = add(new THREE.BoxGeometry(3.6, .1, 1), std(0x5a3a24, 1), .8, .19, -1.8);
    const flowerCols = [0xe9a23b, 0xd96b7a, 0xf2efe9, 0xb58ad8, 0xe8d15c];
    for (let i = 0; i < 26; i++) { const f = add(new THREE.SphereGeometry(.1 + Math.random() * .06, 10, 8), std(flowerCols[i % 5], .7), -.9 + Math.random() * 3.4, .32, -2.2 + Math.random() * .8); f.scale.set(1, .001, 1); anim.push({ type: "flower", m: f, i }); }
    for (let i = 0; i < 8; i++) add(new THREE.SphereGeometry(.28, 12, 10), std(0x4d7447, .9), -.6 + i * .45, .38, -1.35);
    // arbre
    add(new THREE.CylinderGeometry(.12, .16, 1.6, 8), std(0x4a3b31, 1), 3.2, .94, 2.6);
    const canopy = add(new THREE.IcosahedronGeometry(1.15, 1), std(0x56844c, .9), 3.2, 2.4, 2.6); anim.push({ type: "tree", m: canopy });
    add(new THREE.IcosahedronGeometry(.7, 1), std(0x4c7744, .9), 2.6, 2.0, 2.9);
  }

  /* état et rendu */
  const state = { p: 0, ps: 0, px: 0, py: 0, pxs: 0, pys: 0, t: 0, run: false, last: 0, w: 1, h: 1 };
  function resize() { const r = canvas.getBoundingClientRect(); state.w = Math.max(2, r.width); state.h = Math.max(2, r.height); renderer.setSize(state.w, state.h, false); camera.aspect = state.w / state.h; camera.updateProjectionMatrix(); }
  function update(dt) {
    state.t += dt; state.ps += (state.p - state.ps) * clamp(dt * 3);
    state.pxs += (state.px - state.pxs) * clamp(dt * 2.5); state.pys += (state.py - state.pys) * clamp(dt * 2.5);
    const p = state.ps, t = state.t;
    root.rotation.y = -.55 + p * 1.1 + Math.sin(t * .12) * .04;
    const dist = state.w / state.h < 1 ? 27 : 22;
    camera.position.set(state.pxs * 1.4, 12.5 - p * 2.5 - state.pys * .8, dist);
    camera.lookAt(0, .6, 0);
    for (const a of anim) {
      if (a.type === "truck") {
        const tilt = smooth(.05, .55, p);
        a.dumpPivot.rotation.z = tilt * .85;
        a.load.scale.y = Math.max(.01, 1 - smooth(.25, .85, p)); a.load.position.y = .72 - (1 - a.load.scale.y) * .15;
        a.heap.scale.y = Math.max(.001, smooth(.25, .95, p));
        const flow = smooth(.22, .3, p) * (1 - smooth(.85, .95, p));
        for (let i = 0; i < a.N; i++) {
          const s = a.seeds[i], k = (t * .9 + s) % 1;
          a.pos[i * 3] = -1.65 - k * .35 + (s - .5) * .2; a.pos[i * 3 + 1] = .75 - k * k * .8; a.pos[i * 3 + 2] = (s * 7 % 1 - .5) * .9;
          if (flow < .05) a.pos[i * 3 + 1] = -10;
        }
        a.fall.geometry.attributes.position.needsUpdate = true;
        a.beacon.material.emissiveIntensity = 1 + Math.pow(Math.max(0, Math.sin(t * 7)), 6) * 5;
      } else if (a.type === "flower") a.m.scale.y = Math.max(.001, smooth(.05 + (a.i % 13) * .02, .35 + (a.i % 13) * .02, p + .25));
      else if (a.type === "tree") a.m.rotation.y = Math.sin(t * .4) * .05;
    }
  }
  function frame(now) { if (!state.run) return; requestAnimationFrame(frame); const dt = Math.min(.05, state.last ? (now - state.last) / 1000 : .016); state.last = now; update(dt); renderer.render(scene, camera); }
  resize(); update(.016); renderer.render(scene, camera);
  addEventListener("resize", resize);
  return {
    setProgress(p) { state.p = clamp(p); }, setPointer(x, y) { state.px = x; state.py = y; },
    start() { if (state.run) return; state.run = true; state.last = 0; requestAnimationFrame(frame); }, stop() { state.run = false; },
    resize
  };
}

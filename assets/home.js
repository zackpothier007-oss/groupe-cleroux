/* Accueil : chargement, ouverture, récit 3D piloté par le défilement, services en défilement horizontal */
import { createScene, detectTier } from "./scene.js";

const Site = window.Site || {};
window.__homeAlive = true;
const gsap = window.gsap, ST = window.ScrollTrigger;
const reduce = !!Site.reduce;
const html = document.documentElement;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const returning = html.classList.contains("veil-in");
if (returning) { html.classList.remove("veil-in"); Site.store && Site.store.del("cl-veil"); }

const loader = document.querySelector(".loader");
const pctEl = loader && loader.querySelector("[data-pct]");
const barEl = loader && loader.querySelector(".loader__bar");
const stage = document.querySelector(".story__stage");
const canvas = document.getElementById("laval");
const steps = [...document.querySelectorAll(".step")].map(el => ({ el, r: el.dataset.range.split(",").map(Number), hero: el.classList.contains("step--hero") }));
const hud = Object.fromEntries([...document.querySelectorAll("[data-hud]")].map(el => [el.dataset.hud, el]));
const cue = document.querySelector(".scroll-cue");
const t0 = performance.now();

/* ---------- écran de chargement : pourcentage et flocons qui se rassemblent ---------- */
let target = 0, shown = 0, loaderAlive = true;
const lc = loader && loader.querySelector("canvas"), lctx = lc && lc.getContext("2d");
let flakes = [], lw = 0, lh = 0, burst = 0;
function sizeLoader() {
  if (!lc) return; const d = Math.min(devicePixelRatio, 2); lw = innerWidth; lh = innerHeight; lc.width = lw * d; lc.height = lh * d; lctx.setTransform(d, 0, 0, d, 0, 0);
  flakes = Array.from({ length: Math.round(Math.min(220, lw * lh / 5200)) }, () => {
    const a = Math.random() * Math.PI * 2, r = Math.max(lw, lh) * (.45 + Math.random() * .4);
    return { sx: lw / 2 + Math.cos(a) * r, sy: lh / 2 + Math.sin(a) * r, tx: lw / 2 + (Math.random() - .5) * Math.min(760, lw * .88), ty: lh / 2 + (Math.random() - .5) * 120, r: Math.random() * 1.8 + .6, d: Math.random() * .5, ph: Math.random() * 6 };
  });
}
sizeLoader(); addEventListener("resize", sizeLoader);
let lastL = 0;
function loaderLoop(now) {
  if (!loaderAlive) return;
  const dt = Math.min(.25, lastL ? (now - lastL) / 1000 : .016); lastL = now;
  shown += (target - shown) * (1 - Math.exp(-dt * 4.5)); shown = Math.min(target, shown + dt * 14);
  if (pctEl) pctEl.textContent = String(Math.round(shown)).padStart(3, "0");
  if (barEl) barEl.style.width = shown + "%";
  if (lctx) {
    lctx.clearRect(0, 0, lw, lh);
    const k = clamp(shown / 100), t = now / 1000;
    for (const f of flakes) {
      const e = smooth(f.d, 1, k * 1.15);
      let x = f.sx + (f.tx - f.sx) * e + Math.sin(t * 1.3 + f.ph) * 6 * (1 - e);
      let y = f.sy + (f.ty - f.sy) * e + Math.cos(t + f.ph) * 4;
      if (burst > 0) { const dx = f.tx - lw / 2, dy = f.ty - lh / 2; x += dx * burst * 1.6; y += (dy - 60) * burst * 3 - burst * 140; }
      lctx.globalAlpha = (.25 + e * .55) * (1 - burst);
      lctx.fillStyle = e > .9 ? "#2B74A8" : "#526677";
      lctx.beginPath(); lctx.arc(x, y, f.r, 0, 6.283); lctx.fill();
    }
  }
  requestAnimationFrame(loaderLoop);
}
if (loader) requestAnimationFrame(loaderLoop);

/* ---------- état du récit ---------- */
let scene = null, mode = "webgl", video = null, poster = null, timeline = null;
let pTarget = 0, pShown = 0, engineLast = -1, night = false;

function applyStory(st) {
  const p = st.p;
  for (const s of steps) {
    const [a, b] = s.r;
    let o = s.hero ? 1 - smooth(b - .04, b, p) : smooth(a, a + .03, p) * (1 - smooth(b - .03, b, p));
    if (s.hero && !opened) o = 1;
    s.el.style.opacity = o.toFixed(3);
    s.el.classList.toggle("is-on", o > .01);
    const y = (s.hero ? -60 * (1 - o) : (p < (a + b) / 2 ? 34 : -34) * (1 - o));
    s.el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
  }
  const isNight = night ? st.dark > .5 : st.dark > .58;
  if (isNight !== night) {
    night = isNight; stage.classList.toggle("story--night", night);
    stage.style.setProperty("--story-fg", night ? "#F3F7FA" : "var(--ink)");
    stage.style.setProperty("--story-glow", night ? "#0D1A26" : "#F3F7FA");
  }
  if (hud.snow) hud.snow.style.transform = `scaleX(${st.snow.toFixed(3)})`;
  if (hud.streets) hud.streets.textContent = Math.round(st.streets * 100) + " %";
  if (hud.drives) hud.drives.textContent = `${st.drives}/${st.drivesMax}`;
  if (hud.lots) hud.lots.textContent = Math.round(st.lots * 100) + " %";
  if (cue) cue.style.opacity = String(1 - smooth(0, .03, p));
  if (Site.sound && Site.sound.on && Math.abs(st.engine - engineLast) > .02) { engineLast = st.engine; Site.sound.setEngine(.15 + st.engine * .85); }
}

/* La vidéo cellulaire : on retrouve les mêmes compteurs que la 3D, enregistrés image par image */
function statsFromTimeline(p) {
  if (!timeline || !timeline.frames) return { p, snow: 0, dark: 0, streets: 0, drives: 0, drivesMax: 0, lots: 0, engine: 0 };
  const fr = timeline.frames, i = Math.min(fr.length - 1, Math.round(p * (fr.length - 1)));
  const s = fr[i]; return { p, snow: s[0], dark: s[1], streets: s[2], drives: s[3], drivesMax: timeline.drivesMax, lots: s[4], engine: s[5] };
}
function videoLoop() {
  pShown += (pTarget - pShown) * .085;
  if (video && video.readyState >= 2 && video.duration) {
    const tt = pShown * (video.duration - .05);
    if (!video.seeking && Math.abs(video.currentTime - tt) > .02) video.currentTime = tt;
  }
  applyStory(statsFromTimeline(pShown));
  requestAnimationFrame(videoLoop);
}

async function setupStage() {
  let tier = detectTier();
  if (tier === "low" || tier === "none") mode = "poster";
  // cellulaire : 3D allégée (la vidéo pré-rendue viendra plus tard)
  else if (tier === "mobile") tier = "low";
  if (mode === "webgl") {
    try {
      scene = await createScene(canvas, { tier, onStep: f => { target = 22 + f * 74; }, onFrame: applyStory });
    } catch (err) { console.warn("Scène 3D indisponible", err); mode = "poster"; scene = null; }
  }
  if (mode === "video") {
    canvas.remove();
    video = document.createElement("video");
    Object.assign(video, { muted: true, playsInline: true, preload: "auto", src: "assets/laval-mobile.mp4", poster: "assets/img/laval-poster.webp" });
    video.setAttribute("muted", ""); video.setAttribute("playsinline", ""); video.setAttribute("aria-hidden", "true");
    stage.prepend(video);
    try { const r = await fetch("assets/laval-mobile.json"); timeline = await r.json(); } catch (e) { timeline = null; }
    await Promise.race([new Promise(r => video.addEventListener("loadeddata", r, { once: true })), new Promise(r => video.addEventListener("error", r, { once: true })), wait(5000)]);
    // iOS ne décode les images d'une vidéo qu'après un premier « play »
    try { await video.play(); video.pause(); } catch (e) {}
    target = 96;
    requestAnimationFrame(videoLoop);
  }
  if (mode === "poster") {
    if (canvas.isConnected) canvas.remove();
    poster = document.createElement("img"); poster.className = "poster"; poster.alt = ""; poster.src = "assets/img/laval-poster.webp";
    stage.prepend(poster); target = 96;
    try { const r = await fetch("assets/laval-mobile.json"); timeline = await r.json(); } catch (e) {}
    requestAnimationFrame(videoLoop);
  }
}

/* ---------- défilement : la progression du récit ---------- */
function setupScroll() {
  if (!ST) return;
  ST.create({
    trigger: "#story", start: "top top", end: "bottom bottom",
    onUpdate: self => { pTarget = self.progress; scene && scene.setProgress(self.progress); }
  });
  if (scene) {
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? scene.start() : scene.stop()), { rootMargin: "100px" });
    io.observe(document.getElementById("story"));
    addEventListener("pointermove", e => scene.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => scene.resize(), 120); });
  }

  /* services : la section s'épingle et défile de gauche à droite */
  const section = document.getElementById("services"), track = section.querySelector(".track");
  const countEl = section.querySelector("[data-srv-count]"), bar = section.querySelector(".services__progress .bar i");
  const n = track.children.length;
  if (reduce) { track.parentElement.style.overflowX = "auto"; return; }
  const dist = () => Math.max(0, track.scrollWidth - innerWidth + 24);
  gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: section, start: "top top", end: () => "+=" + dist() * 1.15, scrub: 1.2, pin: true, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: self => { const i = Math.min(n, Math.floor(self.progress * (n - .01)) + 1); countEl.textContent = `${i} / ${n}`; bar.style.transform = `scaleX(${(.2 + self.progress * .8).toFixed(3)})`; }
    }
  });
  track.querySelectorAll(".panel__media img").forEach(img => gsap.fromTo(img, { xPercent: -4 }, { xPercent: 4, ease: "none", scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + dist() * 1.15, scrub: true } }));
}

/* ---------- ouverture cinématographique ---------- */
let opened = false;
function openStage() {
  opened = true; window.__homeStarted = true;
  if (scene) { reduce ? scene.skipIntro() : scene.playIntro(); scene.start(); }
  Site.start && Site.start();
  const title = document.querySelector(".step--hero h1");
  const lead = document.querySelectorAll(".step--hero .label, .step--hero .hero-lead, .step--hero .hero-actions, .hud, .scroll-cue, .site-head");
  if (!gsap || reduce) { loader && loader.remove(); loaderAlive = false; return; }
  const halves = loader.querySelectorAll(".loader__half"), mark = loader.querySelector(".loader__mark"), meta = loader.querySelector(".loader__meta"), lbar = loader.querySelector(".loader__bar");
  loader.style.pointerEvents = "none";
  const tl = gsap.timeline({ onComplete: () => { loaderAlive = false; loader.remove(); ST && ST.refresh(); } });
  tl.to(mark, { y: -30, opacity: 0, duration: .8, ease: "power3.in" })
    .to([meta, lbar], { opacity: 0, duration: .5 }, "<")
    .to({ b: 0 }, { b: 1, duration: 1.4, ease: "power2.out", onUpdate() { burst = this.targets()[0].b; } }, "<.2")
    .to(halves[0], { yPercent: -100, duration: 1.6, ease: "expo.inOut" }, "<.15")
    .to(halves[1], { yPercent: 100, duration: 1.6, ease: "expo.inOut" }, "<");
  gsap.from(lead, { y: 24, opacity: 0, duration: 1.4, ease: "expo.out", stagger: .08, delay: 1.25 });
  Site.revealTitle && Site.revealTitle(title, { delay: 1.05 });
}

/* ---------- démarrage ---------- */
(async function main() {
  target = 8;
  try { await Promise.race([Promise.all([document.fonts.ready, document.fonts.load("500 40px 'IBM Plex Mono'"), document.fonts.load("400 120px 'Bodoni Moda'")]), wait(2600)]); } catch (e) {}
  target = 20;
  await setupStage();
  setupScroll();
  target = 100;
  const minTime = returning ? 900 : 2900;
  while (shown < 99.4) await wait(40);
  const left = minTime - (performance.now() - t0); if (left > 0) await wait(left);
  openStage();
})();

/* Groupe Cléroux — comportements communs à toutes les pages */
(function(){
  "use strict";
  const html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const store = {
    get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } },
    set(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} },
    del(k){ try{ sessionStorage.removeItem(k); }catch(e){} }
  };
  const Site = window.Site = { reduce, fine, store, ready:false, onReady:[] };
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Défilement lent et lourd (Lenis) ---------- */
  if (!reduce && window.Lenis && hasGsap) {
    const lenis = new Lenis({ lerp: 0.042, wheelMultiplier: 0.62, touchMultiplier: 1.1, smoothWheel: true });
    Site.lenis = lenis;
    lenis.on("scroll", () => window.ScrollTrigger && ScrollTrigger.update());
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  Site.scrollTo = (target, opts) => {
    if (Site.lenis) Site.lenis.scrollTo(target, Object.assign({ duration: 2.2 }, opts || {}));
    else {
      const el = typeof target === "string" ? document.querySelector(target) : target;
      if (typeof target === "number") window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
      else if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }
  };
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); Site.scrollTo(id, { offset: -70 }); }
  });

  /* ---------- En-tête et bouton flottant ---------- */
  const head = document.querySelector(".site-head");
  const floatCta = document.querySelector(".float-cta");
  const floatAfter = () => (floatCta && floatCta.dataset.after) ? document.querySelector(floatCta.dataset.after) : null;
  function onScroll(){
    const y = window.scrollY;
    if (head) head.classList.toggle("is-scrolled", y > 40);
    if (floatCta) {
      const el = floatAfter();
      const limit = el ? el.offsetTop + el.offsetHeight * 0.85 : innerHeight * 0.7;
      const nearEnd = (innerHeight + y) > document.documentElement.scrollHeight - 160;
      floatCta.classList.toggle("is-visible", y > limit && !nearEnd);
    }
  }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Menu cellulaire ---------- */
  const mnav = document.querySelector(".mobile-nav");
  document.querySelectorAll("[data-menu-open]").forEach(b => b.addEventListener("click", () => {
    mnav.classList.add("is-open"); b.setAttribute("aria-expanded", "true"); Site.lenis && Site.lenis.stop();
    const first = mnav.querySelector("a"); first && first.focus();
  }));
  function closeMenu(){
    if (!mnav) return; mnav.classList.remove("is-open");
    document.querySelectorAll("[data-menu-open]").forEach(b => b.setAttribute("aria-expanded","false"));
    Site.lenis && Site.lenis.start();
  }
  document.querySelectorAll("[data-menu-close]").forEach(b => b.addEventListener("click", closeMenu));
  addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  /* ---------- Curseur personnalisé ---------- */
  if (fine && !reduce) {
    html.classList.add("has-cursor");
    const c = document.createElement("div"); c.className = "cursor"; c.setAttribute("aria-hidden","true");
    document.body.appendChild(c);
    let x = innerWidth/2, y = innerHeight/2, cx = x, cy = y;
    addEventListener("pointermove", e => { x = e.clientX; y = e.clientY; c.classList.add("is-on"); }, { passive: true });
    document.addEventListener("pointerleave", () => c.classList.remove("is-on"));
    addEventListener("pointerdown", () => c.classList.add("is-down"));
    addEventListener("pointerup", () => c.classList.remove("is-down"));
    document.addEventListener("pointerover", e => {
      const t = e.target.closest("a, button, summary, label, [data-cursor], input, select, textarea");
      if (!t) { c.classList.remove("is-hover"); c.textContent = ""; return; }
      if (t.matches("input, select, textarea")) { c.classList.remove("is-hover"); c.textContent=""; c.style.opacity = ".25"; return; }
      c.style.opacity = "";
      const label = t.dataset.cursor || (t.tagName === "A" && !t.getAttribute("href").startsWith("#") ? "Voir" : "Cliquer");
      c.textContent = label; c.classList.add("is-hover");
    });
    (function loop(){
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      c.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Boutons magnétiques ---------- */
  if (fine && !reduce && hasGsap) {
    document.querySelectorAll("[data-magnetic]").forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      const xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1,0.45)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1,0.45)" });
      el.addEventListener("pointermove", e => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width/2)) * strength);
        yTo((e.clientY - (r.top + r.height/2)) * strength);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  /* ---------- Titres : lettres qui se révèlent / se dispersent en flocons ---------- */
  function split(el){
    if (el.dataset.splitDone) return el.querySelectorAll(".c");
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w";
            [...part].forEach(ch => { const s = document.createElement("span"); s.className = "c"; s.textContent = ch; w.appendChild(s); });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.matches("br")) walk(n);
      });
    };
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g," ").trim());
    walk(el);
    el.querySelectorAll(".w").forEach(w => w.setAttribute("aria-hidden","true"));
    el.classList.add("split"); el.dataset.splitDone = "1";
    return el.querySelectorAll(".c");
  }
  Site.split = split;
  Site.revealTitle = (el, opts) => {
    const chars = split(el);
    if (!hasGsap || reduce) return null;
    return gsap.from(chars, Object.assign({ yPercent: 115, rotate: 4, duration: 1.35, ease: "expo.out", stagger: 0.022 }, opts || {}));
  };
  function initTitles(){
    if (!hasGsap) return;
    document.querySelectorAll("[data-split]").forEach(el => {
      const mode = el.dataset.split;
      const chars = split(el);
      if (reduce) return;
      if (mode === "scroll") {
        gsap.from(chars, { yPercent: 115, rotate: 4, duration: 1.4, ease: "expo.out", stagger: 0.018,
          scrollTrigger: { trigger: el, start: "top 86%", once: true } });
      }
      if (el.hasAttribute("data-scatter")) {
        gsap.to(chars, {
          y: () => -40 - Math.random() * 120, x: () => (Math.random() - 0.5) * 120,
          rotate: () => (Math.random() - 0.5) * 90, opacity: 0, filter: "blur(6px)", scale: 0.4,
          ease: "none", stagger: { each: 0.004, from: "random" },
          scrollTrigger: { trigger: el, start: "top 18%", end: "top -22%", scrub: 1.2 }
        });
      }
    });
    document.querySelectorAll("[data-fade]").forEach(el => {
      if (reduce) return;
      gsap.from(el, { y: 40, opacity: 0, duration: 1.4, ease: "expo.out", delay: parseFloat(el.dataset.fade) || 0,
        scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });
    document.querySelectorAll(".photo img").forEach(img => {
      if (reduce) return;
      gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none",
        scrollTrigger: { trigger: img.closest(".photo"), start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  /* ---------- Compteurs ---------- */
  function initCounters(){
    document.querySelectorAll("[data-count]").forEach(el => {
      const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || "0", 10);
      const fmt = v => v.toFixed(dec).replace(".", ",");
      if (!hasGsap || reduce) { el.textContent = fmt(to); return; }
      const o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () =>
        gsap.to(o, { v: to, duration: 2.6, ease: "power3.out", onUpdate: () => el.textContent = fmt(o.v) }) });
      el.textContent = fmt(0);
    });
  }

  /* ---------- Cartes qui penchent en 3D ---------- */
  function initTilt(){
    if (!fine || reduce || !hasGsap) return;
    document.querySelectorAll("[data-tilt]").forEach(card => {
      gsap.set(card, { transformPerspective: 900 });
      const rx = gsap.quickTo(card, "rotationX", { duration: .9, ease: "power3.out" });
      const ry = gsap.quickTo(card, "rotationY", { duration: .9, ease: "power3.out" });
      const glare = card.querySelector(".glare");
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        rx(-py * 14); ry(px * 16);
        if (glare) glare.style.background = `radial-gradient(circle at ${(px+.5)*100}% ${(py+.5)*100}%, rgba(255,255,255,.55), transparent 55%)`;
      });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); if (glare) glare.style.background = "transparent"; });
    });
  }

  /* ---------- Accordéon animé ---------- */
  function initFaq(){
    document.querySelectorAll(".faq details").forEach(d => {
      const s = d.querySelector("summary"), body = d.querySelector(".faq__body");
      s.addEventListener("click", e => {
        if (!hasGsap || reduce) return;
        e.preventDefault();
        if (d.open) {
          gsap.to(body, { height: 0, duration: .7, ease: "expo.inOut", onComplete: () => { d.open = false; body.style.height = ""; ScrollTrigger.refresh(); } });
        } else {
          d.open = true;
          gsap.fromTo(body, { height: 0 }, { height: body.scrollHeight, duration: .9, ease: "expo.out", onComplete: () => { body.style.height = ""; ScrollTrigger.refresh(); } });
        }
      });
    });
  }

  /* ---------- Copier un numéro ou un courriel ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-copy]"); if (!b) return;
    const val = b.dataset.copy, tag = b.querySelector("small");
    const done = ok => { if (tag) { const t = tag.textContent; tag.textContent = ok ? "Copié" : "Sélectionné"; setTimeout(() => tag.textContent = t, 1800); } };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(b.querySelector("span") || b); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); done(false); };
    try { navigator.clipboard.writeText(val).then(() => done(true), fallback); } catch (err) { fallback(); }
  });

  /* ---------- Transitions entre les pages ---------- */
  const veil = document.querySelector(".veil");
  function veilOut(){
    if (!veil || !html.classList.contains("veil-in")) return;
    store.del("cl-veil");
    if (!hasGsap || reduce) { html.classList.remove("veil-in"); return; }
    const panels = veil.querySelectorAll(".veil__panel"), word = veil.querySelector(".veil__word");
    gsap.set(panels, { yPercent: 0 }); veil.classList.add("is-active"); html.classList.remove("veil-in");
    gsap.set(word, { opacity: 1 });
    gsap.timeline({ delay: .15, onComplete: () => veil.classList.remove("is-active") })
      .to(word, { opacity: 0, y: -20, duration: .5, ease: "power2.in" })
      .to(panels[1], { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "-=.1")
      .to(panels[0], { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, "-=.95")
      .set(panels, { yPercent: 100 });
  }
  Site.veilOut = veilOut;
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
    const href = a.getAttribute("href");
    if (!/^[\w-]+\.html(#[\w-]+)?$/.test(href)) return;
    e.preventDefault(); closeMenu();
    store.set("cl-veil", "1");
    if (!veil || !hasGsap || reduce) { location.href = href; return; }
    const panels = veil.querySelectorAll(".veil__panel"), word = veil.querySelector(".veil__word");
    word.textContent = a.dataset.veil || "Groupe Cléroux";
    veil.classList.add("is-active");
    gsap.timeline({ onComplete: () => { location.href = href; } })
      .fromTo(panels[0], { yPercent: 100 }, { yPercent: 0, duration: .9, ease: "expo.inOut" })
      .fromTo(panels[1], { yPercent: 100 }, { yPercent: 0, duration: .9, ease: "expo.inOut" }, "-=.78")
      .fromTo(word, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .5, ease: "power2.out" }, "-=.3");
    Site.sound && Site.sound.fadeTo && Site.sound.fadeTo(0.4);
  });
  addEventListener("pageshow", e => { if (e.persisted) { html.classList.remove("veil-in"); veil && hasGsap && gsap.set(veil.querySelectorAll(".veil__panel"), { yPercent: 100 }); } });

  /* ---------- Son : vent d'hiver et moteurs (synthétisés, désactivés par défaut) ---------- */
  const sound = Site.sound = { on: false, ctx: null, engineTarget: 0.25 };
  sound.build = function(){
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // vent : bruit brun filtré, modulé lentement
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.7;
    const windGain = ctx.createGain(); windGain.gain.value = 0.55;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lfoG = ctx.createGain(); lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(bp.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.17; const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.25;
    lfo2.connect(lfo2G).connect(windGain.gain);
    noise.connect(bp).connect(windGain).connect(master);
    // moteur : diesel grave, lointain
    const eng = this.engine = ctx.createGain(); eng.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 180; lp.Q.value = 3;
    [[38,"sawtooth",.35],[76,"square",.12],[19,"sine",.5]].forEach(([f,t,g]) => { const o = ctx.createOscillator(); o.type = t; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g; o.connect(og).connect(lp); o.start(); this.osc = this.osc || []; this.osc.push(o); });
    const rumble = ctx.createOscillator(); rumble.frequency.value = 11; const rg = ctx.createGain(); rg.gain.value = 0.18;
    rumble.connect(rg).connect(eng.gain);
    lp.connect(eng).connect(master);
    noise.start(); lfo.start(); lfo2.start(); rumble.start();
    return true;
  };
  sound.setEngine = function(v){ this.engineTarget = v; if (this.ctx && this.on) this.engine.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.6); };
  sound.fadeTo = function(v){ if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4); };
  sound.toggle = function(force){
    const want = typeof force === "boolean" ? force : !this.on;
    if (want && !this.ctx && !this.build()) return;
    this.on = want;
    if (this.ctx) {
      if (want && this.ctx.state === "suspended") this.ctx.resume();
      this.master.gain.setTargetAtTime(want ? 0.9 : 0, this.ctx.currentTime, 0.5);
      this.engine.gain.setTargetAtTime(want ? this.engineTarget * 0.5 : 0, this.ctx.currentTime, 0.6);
    }
    store.set("cl-sound", want ? "1" : "0");
    document.querySelectorAll("[data-sound]").forEach(b => { b.setAttribute("aria-pressed", want ? "true" : "false");
      b.setAttribute("aria-label", want ? "Couper le son" : "Activer le son d'ambiance"); });
  };
  document.querySelectorAll("[data-sound]").forEach(b => b.addEventListener("click", () => sound.toggle()));
  // Le navigateur exige un clic avant de jouer un son : on rallume au premier clic si le visiteur l'avait activé.
  if (store.get("cl-sound") === "1") {
    document.querySelectorAll("[data-sound]").forEach(b => b.setAttribute("aria-pressed","false"));
    addEventListener("pointerdown", function once(e){ if (!e.target.closest("[data-sound]")) sound.toggle(true); removeEventListener("pointerdown", once); }, { once: true });
  }

  /* ---------- Neige du grand appel à l'action ---------- */
  function initFinalSnow(){ document.querySelectorAll(".final canvas, canvas[data-snow]").forEach(snowCanvas); }
  function snowCanvas(cv){
    if (!cv || reduce) return;
    const ctx = cv.getContext("2d"); let w, h, flakes = [], running = false;
    const resize = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2); w = r.width; h = r.height; cv.width = w * d; cv.height = h * d; ctx.setTransform(d,0,0,d,0,0);
      flakes = Array.from({ length: Math.round(w * h / 9000) }, () => ({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*2.2+.4, s: Math.random()*.6+.25, o: Math.random()*.6+.2, p: Math.random()*6 })); };
    resize(); addEventListener("resize", resize);
    const io = new IntersectionObserver(es => { running = es[0].isIntersecting; if (running) tick(); });
    io.observe(cv);
    let t = 0;
    function tick(){ if (!running) return; t += .01; ctx.clearRect(0,0,w,h);
      for (const f of flakes) { f.y += f.s; f.x += Math.sin(t + f.p) * .35 + .15; if (f.y > h + 4) { f.y = -4; f.x = Math.random()*w; } if (f.x > w + 4) f.x = -4;
        ctx.globalAlpha = f.o; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fillStyle = "#fff"; ctx.fill(); }
      requestAnimationFrame(tick); }
  }

  /* ---------- Démarrage ---------- */
  Site.start = function(){
    if (Site.ready) return; Site.ready = true;
    initTitles(); initCounters(); initTilt(); initFaq(); initFinalSnow();
    Site.onReady.forEach(f => f());
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };
  // Les pages sans écran de chargement démarrent tout de suite.
  if (!document.querySelector(".loader")) {
    const go = () => { const veiled = html.classList.contains("veil-in"); Site.start(); veilOut();
      document.querySelectorAll("[data-split='load']").forEach((el,i) => Site.revealTitle(el, { delay: veiled ? .95 : .25 + i*.1 })); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  }
})();

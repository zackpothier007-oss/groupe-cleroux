/* Monte la petite maquette 3D d'une page service et la lie au défilement */
import { mountSpecimen } from "./specimen.js";

const el = document.querySelector("[data-specimen]");
if (el) {
  const canvas = el.querySelector("canvas");
  const mobile = matchMedia("(pointer: coarse)").matches;
  let s = null;
  try { s = mountSpecimen(canvas, el.dataset.specimen, { mobile }); } catch (e) { s = null; }
  if (!s) el.classList.add("is-static");
  else {
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? s.start() : s.stop()));
    io.observe(el);
    const state = { intro: 0, scroll: 0 };
    const apply = () => s.setProgress(Math.max(state.intro, state.scroll));
    if (window.gsap && !(window.Site && Site.reduce)) gsap.to(state, { intro: .42, duration: 3.4, delay: .5, ease: "power2.inOut", onUpdate: apply });
    else { state.intro = .6; apply(); }
    if (window.ScrollTrigger) ScrollTrigger.create({ trigger: el, start: "top 70%", end: "bottom top", onUpdate: self => { state.scroll = self.progress; apply(); } });
    if (!mobile) addEventListener("pointermove", e => s.setPointer(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
    new ResizeObserver(() => s.resize()).observe(el);
  }
}

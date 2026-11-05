/* Formulaire de soumission en 3 étapes : service → propriété → coordonnées */
const form = document.getElementById("quote");
const done = document.getElementById("done");
const progress = document.querySelector(".progress");
const steps = [...form.querySelectorAll(".fstep")];
const back = form.querySelector("[data-back]");
const next = form.querySelector("[data-next]");
const nextLabel = form.querySelector("[data-next-label]");
const gsap = window.gsap;
const reduce = !!(window.Site && Site.reduce);
let cur = 1, busy = false;

const LABELS = { "deneigement-residentiel": "Déneigement résidentiel", "deneigement-commercial": "Déneigement commercial", "vrac": "Transport ou matériaux en vrac", "paysager": "Entretien ou aménagement paysager", "autre": "Autre demande" };

// Préselection depuis le lien (ex. soumission.html#vrac)
const hash = location.hash.slice(1);
const pre = form.querySelector(`input[name="service"][value="${CSS.escape(hash)}"]`);
if (pre) pre.checked = true;

const service = () => (form.querySelector('input[name="service"]:checked') || {}).value;

function syncConditional() {
  const s = service();
  form.querySelectorAll("[data-for]").forEach(el => { el.hidden = el.dataset.for !== s; });
}
form.addEventListener("change", e => { if (e.target.name === "service") { syncConditional(); setErr("service", ""); } });
syncConditional();

function setErr(name, msg) {
  const err = document.getElementById("err-" + name);
  if (err) err.textContent = msg;
  const input = form.elements[name];
  if (input && input.setAttribute && !(input instanceof RadioNodeList)) {
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg) input.setAttribute("aria-describedby", "err-" + name); else input.removeAttribute("aria-describedby");
  }
  return !msg;
}

function validate(step) {
  let ok = true, first = null;
  const check = (name, cond, msg) => { const good = setErr(name, cond ? "" : msg); if (!good) { ok = false; first = first || form.elements[name]; } };
  if (step === 1) check("service", !!service(), "Choisissez un service pour continuer.");
  if (step === 2) check("adresse", form.elements.adresse.value.trim().length > 3, "Indiquez l'adresse de la propriété ou du chantier.");
  if (step === 3) {
    check("nom", form.elements.nom.value.trim().length > 1, "Indiquez votre nom.");
    check("courriel", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.elements.courriel.value.trim()), "Entrez un courriel valide, par exemple nom@exemple.com.");
    check("telephone", form.elements.telephone.value.replace(/\D/g, "").length >= 10, "Entrez un numéro de téléphone à 10 chiffres.");
  }
  if (first) { const f = first instanceof RadioNodeList ? first[0] : first; f && f.focus && f.focus(); }
  return ok;
}
form.querySelectorAll("input, textarea").forEach(i => i.addEventListener("input", () => { if (i.getAttribute("aria-invalid") === "true") setErr(i.name, ""); }));

function paint() {
  progress.querySelectorAll("li").forEach(li => { const n = +li.dataset.prog; li.classList.toggle("is-current", n === cur); li.classList.toggle("is-done", n < cur); li.setAttribute("aria-current", n === cur ? "step" : "false"); });
  back.hidden = cur === 1;
  nextLabel.textContent = cur === 3 ? "Envoyer ma demande" : "Continuer";
}

function go(to) {
  if (busy || to === cur) return;
  const from = steps[cur - 1], into = steps[to - 1], dir = to > cur ? 1 : -1;
  cur = to; paint();
  const focusFirst = () => { const f = into.querySelector("input:not([type=hidden]):not([hidden]), select, textarea"); f && f.focus({ preventScroll: true }); };
  if (!gsap || reduce) { from.hidden = true; into.hidden = false; focusFirst(); return; }
  busy = true;
  gsap.to(from, { x: -40 * dir, opacity: 0, duration: .45, ease: "power2.in", onComplete: () => {
    from.hidden = true; gsap.set(from, { x: 0, opacity: 1 });
    into.hidden = false;
    gsap.fromTo(into, { x: 50 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: .8, ease: "expo.out", onComplete: () => { busy = false; focusFirst(); window.ScrollTrigger && ScrollTrigger.refresh(); } });
  } });
  const top = form.getBoundingClientRect().top + scrollY - 140;
  if (scrollY > top) (window.Site && Site.scrollTo) ? Site.scrollTo(top, { duration: 1.2 }) : scrollTo(0, top);
}

back.addEventListener("click", () => go(cur - 1));
form.addEventListener("submit", e => {
  e.preventDefault();
  if (!validate(cur)) return;
  if (cur < 3) { go(cur + 1); return; }
  finish();
});

function finish() {
  const d = new FormData(form), rows = [];
  const add = (k, v) => { if (v && String(v).trim()) rows.push([k, String(v).trim()]); };
  const s = service();
  add("Service", LABELS[s]);
  add("Secteur", d.get("secteur")); add("Adresse", d.get("adresse"));
  if (s === "deneigement-residentiel") { add("Propriété", d.get("type_residentiel")); add("Entrée", d.get("entree")); }
  if (s === "deneigement-commercial") { add("Type de site", d.get("type_site")); add("Superficie", d.get("superficie")); add("Services", d.getAll("dserv").join(", ")); }
  if (s === "vrac") { add("Matériau", d.get("materiau")); add("Quantité", d.get("quantite")); add("Date souhaitée", d.get("date")); }
  if (s === "paysager") { add("Demande", d.get("type_paysager")); add("Services", d.getAll("pserv").join(", ")); }
  add("Nom", d.get("nom")); add("Entreprise", d.get("entreprise")); add("Courriel", d.get("courriel")); add("Téléphone", d.get("telephone")); add("Message", d.get("message"));
  const dl = done.querySelector("[data-summary]"); dl.innerHTML = "";
  rows.forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
  done.querySelector("[data-done-name]").textContent = String(d.get("nom")).trim().split(/\s+/)[0];
  const show = () => { form.hidden = true; progress.hidden = true; done.hidden = false; done.focus({ preventScroll: true });
    if (gsap && !reduce) gsap.from(done.children, { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: .07 });
    window.ScrollTrigger && ScrollTrigger.refresh(); };
  if (gsap && !reduce) gsap.to([form, progress], { opacity: 0, y: -20, duration: .5, ease: "power2.in", onComplete: show }); else show();
}
paint();

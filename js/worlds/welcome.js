// Assistant de création de planète. Premier lancement : identité (pseudo + âge) -> thème -> design -> modules.
// Aussi utilisé pour créer une planète de plus (sans identité) ou changer le design d'une planète existante.
import { esc } from "./common.js";
import { glyph } from "../glyphs.js";
import { page, icon, statusBadge, toast } from "../ui.js";
import { showGuide } from "../guideui.js";
import { THEMES, THEME_IDS } from "../catalog.js";
import { BANDS, bandOf, bandLabel, sanitizePlanet, isBlocked } from "../policy.js";
import { FX, PALETTES, DESIGNS, autoDesign } from "../design.js";
import { MODULES, GROUPS, suggestions, gameFallback, isKnownModule } from "../modules.js";
import { makeFolder, makeModule } from "../planetmodel.js";
import { profile, upsertPlanet, loadPlanets, MAX_PLANETS } from "../myplanets.js";

const grad = (p) => `linear-gradient(135deg, ${p.color}, ${p.color2 || p.color})`;
const FOLDER_NAMES = { api: "Outils ouverts", made: "Communauté Solunia", google: "Messagerie et fichiers" };

/** Range les modules choisis dans des dossiers par famille (à plat si peu de modules). */
export function buildTree(modIds, resolve) {
  if (modIds.length <= 3) return modIds.map(makeModule);
  const out = [];
  for (const g of GROUPS) {
    const ids = modIds.filter((id) => resolve(id)?.group === g.id);
    if (ids.length) out.push(makeFolder(FOLDER_NAMES[g.id], ids.map(makeModule)));
  }
  return out;
}

export function open(root, { quit, arg = {}, openPlanet, games = [] }) {
  profile.welcomeSeen = true;
  const mode = arg.edit ? "edit" : profile.onboarded ? "create" : "first";
  const steps = mode === "edit" ? ["design"] : mode === "create" ? ["theme", "design", "modules"] : ["identity", "theme", "design", "modules"];
  const existing = arg.edit || null;
  let step = 0;
  let pseudo = "";
  try {
    pseudo = localStorage.getItem("univers.name") || "";
  } catch {
    /* stockage bloqué */
  }
  const startBand = existing ? existing.band : mode === "first" ? null : profile.band;
  const draft = existing
    ? { ...existing, mods: new Set() }
    : { ...autoDesign(THEMES.find((t) => t.minAge <= (startBand || 5))?.id || "espace"), theme: null, band: startBand, mods: new Set() };
  let suggestionsList = [];

  const ui = page(root, { title: mode === "edit" ? "Modifier la planète" : "Créer ma planète", sub: mode === "first" ? "Bienvenue sur Univers" : "Assistant de création", color: "#7aa2ff", color2: "#b388ff", quit, back: mode === "first" ? "Accueil" : "Retour" });
  ui.body.innerHTML = `<div class="wz"><div class="sp-steps" id="wz-steps"></div><div id="wz-view"></div></div>
    <div class="wz-bar"><button type="button" class="sp-btn" id="wz-back">${icon("back", 16)}Précédent</button><button type="button" class="sp-btn primary" id="wz-next">Continuer</button></div>`;
  const $ = (s) => ui.body.querySelector(s);
  const band = () => bandOf(draft.band ?? 5);
  const tint = () => {
    const r = root.querySelector(".sp-root");
    r.style.setProperty("--wc", draft.color || "#7aa2ff");
    r.style.setProperty("--wc2", draft.color2 || draft.color || "#b388ff");
  };

  const allModules = () => {
    const extra = games.filter((g) => !MODULES.some((m) => m.id === `game:${g.id}`)).map(gameFallback);
    return [...MODULES, ...extra];
  };
  const resolveMod = (id) => allModules().find((m) => m.id === id);

  function applyTheme(id) {
    draft.theme = id;
    Object.assign(draft, autoDesign(id));
    draft.mods = new Set();
    for (const g of suggestions(id, band())) for (const it of g.items) if (it.recommended) draft.mods.add(it.module.id);
    tint();
  }

  /* ---------- étapes ---------- */
  const views = {
    identity() {
      return `<p class="sp-eyebrow">Étape 1</p><h1 class="sp-h1">Bienvenue sur Univers</h1>
        <p class="sp-lead">Tu vas créer ta propre planète. Elle ira en orbite autour de la planète principale, et tu choisis tout ce qu'elle contient.</p>
        <label class="sp-field"><span>Ton pseudo</span><input class="sp-input" id="wz-pseudo" maxlength="20" autocomplete="nickname" value="${esc(pseudo)}" placeholder="Comment t'appelles-tu ?" /></label>
        <div class="sp-field"><span>Ton âge</span><div class="sp-chips" id="wz-bands">${BANDS.map((b) => `<button type="button" class="sp-chip ${draft.band === b.id ? "on" : ""}" data-b="${b.id}">${esc(b.label)}</button>`).join("")}</div></div>
        <div class="pl-banner info">${icon("shield", 20)}<span>Ton âge adapte tout le contenu que tu vois. Pour le moment il est simplement déclaré ; une vérification sera ajoutée plus tard. Il reste sur cet appareil.</span></div>`;
    },
    theme() {
      return `<p class="sp-eyebrow">Étape ${steps.indexOf("theme") + 1}</p><h1 class="sp-h1">Quel est le thème de ta planète ?</h1><p class="sp-lead">Le thème prépare un design et des outils adaptés. Tu pourras tout changer ensuite.</p>
        <div class="wz-themes">${THEMES.map((t) => {
          const off = t.minAge > band();
          return `<button type="button" class="sp-card ${t.id === draft.theme ? "sel" : ""} ${off ? "off" : ""}" data-th="${t.id}" ${off ? "disabled" : ""} style="--wc:${t.color}"><span class="ico">${glyph(t.glyph, 28)}</span><b>${esc(t.name)}</b><small>${off ? `Dès ${t.minAge} ans` : esc(DESIGNS[t.id].tags[0])}</small></button>`;
        }).join("")}</div>`;
    },
    design() {
      const sug = Array.from({ length: 3 }, () => autoDesign(draft.theme || "espace"));
      suggestionsList = sug;
      const theme = THEMES.find((t) => t.id === draft.theme);
      return `<p class="sp-eyebrow">Étape ${steps.indexOf("design") + 1}</p><h1 class="sp-h1">Dessine ta planète</h1>
        <div class="wz-prev" id="wz-prev" style="background:${grad(draft)}"></div>
        <p class="sp-eyebrow" style="margin-top:16px">Propositions automatiques${theme ? ` pour « ${esc(theme.name)} »` : ""}</p>
        <div class="wz-sug" id="wz-sug">${sug.map((s, i) => `<button type="button" data-s="${i}" style="background:${grad(s)}">${glyph(s.glyph, 32)}${esc(s.name)}</button>`).join("")}</div>
        <button type="button" class="sp-btn sm" id="wz-reroll">${icon("refresh", 16)}Autres idées</button>
        <h2 class="sp-h2" style="margin-top:22px">Personnaliser</h2>
        <label class="sp-field"><span>Nom</span><input class="sp-input" id="wz-name" maxlength="24" value="${esc(draft.name)}" /></label>
        <label class="sp-field"><span>Slogan</span><input class="sp-input" id="wz-tag" maxlength="60" value="${esc(draft.tag || "")}" /></label>
        <div class="sp-field"><span>Symbole</span><div class="sp-chips">${[...new Set([...(DESIGNS[draft.theme]?.glyphs || []), "planet", "star", "moon", "crown", "sparkles"])].map((g) => `<button type="button" class="sp-chip ${g === draft.glyph ? "on" : ""}" data-gl="${g}" aria-label="${g}">${glyph(g, 20)}</button>`).join("")}</div></div>
        <div class="sp-field"><span>Couleurs</span><div class="wz-pal">${PALETTES.map(([a, b], i) => `<button type="button" data-pal="${i}" aria-label="Palette ${i + 1}" style="background:linear-gradient(135deg,${a},${b})" class="${a === draft.color && b === draft.color2 ? "on" : ""}"></button>`).join("")}
          <input type="color" class="sp-input" id="wz-c1" value="${draft.color}" aria-label="Couleur 1" /><input type="color" class="sp-input" id="wz-c2" value="${draft.color2 || draft.color}" aria-label="Couleur 2" /></div></div>
        <div class="sp-field"><span>Décor animé</span><div class="sp-chips">${Object.entries(FX).map(([id, f]) => `<button type="button" class="sp-chip ${id === draft.fx ? "on" : ""}" data-fx="${id}">${f.glyphs[0] ? glyph(f.glyphs[0], 16) : ""}${esc(f.label)}</button>`).join("")}</div></div>
        ${mode === "first" ? "" : `<div class="sp-field"><span>Âge de la planète</span><div class="sp-chips">${BANDS.filter((b) => b.id <= profile.band).map((b) => `<button type="button" class="sp-chip ${b.id === band() ? "on" : ""}" data-bd="${b.id}">${esc(b.label)}</button>`).join("")}</div><small class="sp-muted">Quelqu'un de plus jeune la verra encore plus protégée.</small></div>`}`;
    },
    modules() {
      const groups = suggestions(draft.theme || "espace", band());
      const extra = games.filter((g) => !MODULES.some((m) => m.id === `game:${g.id}`)).map(gameFallback);
      return `<p class="sp-eyebrow">Étape ${steps.indexOf("modules") + 1}</p><h1 class="sp-h1">Que veux-tu dans ta planète ?</h1>
        <p class="sp-lead">Voici des suggestions pour ton thème, cochées pour toi. Chaque module dit s'il est <b>fonctionnel</b> ou une <b>démo</b>. Tu pourras en ajouter, ranger dans des dossiers et sous-dossiers plus tard.</p>
        ${groups.map((g) => `<section class="wz-grp"><h2 class="sp-h2">${esc(g.label)}</h2><p class="sp-muted" style="margin:0 0 10px">${esc(g.sub)}</p>
          ${[...g.items, ...(g.id === "made" ? extra.map((m) => ({ module: m, allowed: m.minAge <= band(), recommended: false })) : [])].map(({ module: m, allowed }) => `<label class="wz-mod ${allowed ? "" : "off"}"><input type="checkbox" data-m="${esc(m.id)}" ${draft.mods.has(m.id) && allowed ? "checked" : ""} ${allowed ? "" : "disabled"} />
            <span class="t"><span class="sp-row"><b>${glyph(m.glyph, 18)} ${esc(m.name)}</b>${allowed ? statusBadge(m.status()) : `<span class="sp-badge plain">${icon("lock", 12)} Dès ${m.minAge} ans</span>`}</span><small class="sp-muted">${esc(m.about)}</small><span class="sp-by">${esc(m.by || "")}</span></span></label>`).join("")}</section>`).join("")}`;
    },
  };

  const preview = () => {
    const el = $("#wz-prev");
    if (!el) return;
    el.style.background = grad(draft);
    el.innerHTML = `<span class="big">${glyph(draft.glyph, 58)}</span><b>${esc(draft.name || "Ma planète")}</b><small>${esc(draft.tag || "")}</small>`;
  };

  function render() {
    const name = steps[step];
    $("#wz-steps").innerHTML = steps.map((_, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("");
    $("#wz-view").innerHTML = views[name]();
    $("#wz-back").style.visibility = step === 0 ? "hidden" : "visible";
    const last = step === steps.length - 1;
    $("#wz-next").textContent = last ? (mode === "edit" ? "Enregistrer" : "Créer ma planète") : "Continuer";
    $("#wz-next").disabled = name === "identity" ? !draft.band : name === "theme" ? !draft.theme : false;
    tint();
    preview();
    window.scrollTo?.(0, 0);
    root.scrollTo?.(0, 0);
    ({ identity: bindIdentity, theme: bindTheme, design: bindDesign, modules: bindModules })[name]();
  }

  const V = () => $("#wz-view");
  function bindIdentity() {
    $("#wz-pseudo").oninput = (e) => (pseudo = e.target.value);
    $("#wz-bands").onclick = (e) => {
      const b = e.target.closest("[data-b]");
      if (!b) return;
      draft.band = bandOf(b.dataset.b);
      for (const c of $("#wz-bands").children) c.classList.toggle("on", c === b);
      $("#wz-next").disabled = false;
    };
  }
  function bindTheme() {
    V().onclick = (e) => {
      const b = e.target.closest("[data-th]");
      if (!b || b.disabled) return;
      applyTheme(b.dataset.th);
      render();
    };
  }
  function bindDesign() {
    const v = V();
    const touch = () => preview();
    $("#wz-sug").onclick = (e) => {
      const b = e.target.closest("[data-s]");
      if (!b) return;
      Object.assign(draft, suggestionsList[b.dataset.s]);
      render();
    };
    $("#wz-reroll").onclick = () => render();
    $("#wz-name").oninput = (e) => { draft.name = e.target.value; touch(); };
    $("#wz-tag").oninput = (e) => { draft.tag = e.target.value; touch(); };
    $("#wz-c1").oninput = (e) => { draft.color = e.target.value; tint(); touch(); };
    $("#wz-c2").oninput = (e) => { draft.color2 = e.target.value; tint(); touch(); };
    v.querySelectorAll("[data-gl]").forEach((b) => (b.onclick = () => { draft.glyph = b.dataset.gl; render(); }));
    v.querySelectorAll("[data-pal]").forEach((b) => (b.onclick = () => { [draft.color, draft.color2] = PALETTES[b.dataset.pal]; render(); }));
    v.querySelectorAll("[data-fx]").forEach((b) => (b.onclick = () => { draft.fx = b.dataset.fx; render(); }));
    v.querySelectorAll("[data-bd]").forEach((b) => (b.onclick = () => { draft.band = bandOf(b.dataset.bd); render(); }));
  }
  function bindModules() {
    V().onchange = (e) => {
      const m = e.target.dataset?.m;
      if (!m) return;
      e.target.checked ? draft.mods.add(m) : draft.mods.delete(m);
    };
  }

  $("#wz-back").onclick = () => {
    step = Math.max(0, step - 1);
    render();
  };
  $("#wz-next").onclick = async () => {
    const name = steps[step];
    if (name === "identity") {
      if (pseudo.trim() && isBlocked(pseudo, 5)) return toast("Choisis un autre pseudo.");
      try {
        localStorage.setItem("univers.name", pseudo.trim().slice(0, 20));
      } catch {
        /* stockage bloqué */
      }
      profile.band = draft.band;
      applyTheme(THEMES.find((t) => t.minAge <= draft.band).id);
      draft.theme = null;
    }
    if (name === "design" && (String(draft.name).trim().length < 2 || isBlocked(draft.name, 5))) return toast("Donne un nom à ta planète (2 lettres minimum, sans mot inadapté).");
    if (step < steps.length - 1) {
      step++;
      return render();
    }
    await finish();
  };

  async function finish() {
    if (!existing && loadPlanets().length >= MAX_PLANETS) return toast("12 planètes maximum : supprime-en une depuis l'Atelier.");
    const mods = [...draft.mods].filter((id) => (resolveMod(id)?.minAge ?? 99) <= band());
    const tree = existing ? existing.tree : buildTree(mods, resolveMod);
    const p = sanitizePlanet({ ...draft, id: existing?.id, tree, band: band() }, isKnownModule, THEME_IDS);
    if (!p) return toast("Vérifie le nom de ta planète.");
    upsertPlanet(p);
    profile.onboarded = true;
    if (existing) {
      toast("Planète enregistrée.");
      return openPlanet(p);
    }
    await showGuide(band(), p.name, p.color);
    openPlanet(p, { welcome: true });
  }

  render();
  return { destroy: ui.destroy };
}

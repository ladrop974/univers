// Atelier : mes planètes, outils (guides d'installation des API, clés, tests) et profil (âge).
import { esc } from "./common.js";
import { glyph } from "../glyphs.js";
import { store } from "./common.js";
import { page, icon, statusBadge, toast, dialog, confirmDialog } from "../ui.js";
import { CONNECTORS, THEMES, byId, run } from "../catalog.js";
import { BANDS, bandLabel, encodePlanet } from "../policy.js";
import { MODULES } from "../modules.js";
import { modulesOf } from "../planetmodel.js";
import * as google from "../google.js";
import { profile, loadPlanets, deletePlanet, MAX_PLANETS } from "../myplanets.js";
import { showGuide } from "../guideui.js";

const grad = (p) => `linear-gradient(135deg, ${p.color}, ${p.color2 || p.color})`;

export function open(root, { quit, openPlanet, openWelcome }) {
  const ui = page(root, { title: "Atelier", sub: "Mes planètes, outils et profil", color: "#7aa2ff", color2: "#b388ff", quit, back: "Accueil" });
  const keys = store("keys");
  let tab = "mine";
  ui.body.innerHTML = `<main class="sp-main"><div class="sp-tabs" id="at-tabs" role="tablist">
      <button class="sp-tab" data-t="mine" role="tab">${icon("orbit", 16)}Mes planètes</button>
      <button class="sp-tab" data-t="tools" role="tab">${icon("tool", 16)}Outils et API</button>
      <button class="sp-tab" data-t="me" role="tab">${icon("user", 16)}Profil</button></div><section id="at-view"></section></main>`;
  const $ = (s) => ui.body.querySelector(s);
  $("#at-tabs").onclick = (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    tab = b.dataset.t;
    render();
  };
  const render = () => {
    for (const b of $("#at-tabs").children) {
      b.classList.toggle("on", b.dataset.t === tab);
      b.setAttribute("aria-selected", b.dataset.t === tab);
    }
    ({ mine: viewMine, tools: viewTools, me: viewMe })[tab]();
  };

  /* ---------- mes planètes ---------- */
  function viewMine() {
    const list = loadPlanets();
    $("#at-view").innerHTML = `<div class="sp-row" style="justify-content:space-between;margin:0 0 12px"><div><h1 class="sp-h2" style="margin:0">Mes planètes</h1><p class="sp-muted" style="margin:2px 0 0">${list.length} sur ${MAX_PLANETS} en orbite autour d'Univers.</p></div>
        <button class="sp-btn primary" id="at-new" ${list.length >= MAX_PLANETS ? "disabled" : ""}>${icon("plus", 16)}Nouvelle planète</button></div>
      ${list.length ? `<div class="sp-grid">${list.map((p) => `<article class="sp-card" style="background:${grad(p)};color:#fff;text-shadow:0 1px 4px rgba(0,0,30,.5)" data-id="${esc(p.id)}">
          <span class="ico">${glyph(p.glyph, 38)}</span><b style="font-size:1.1rem">${esc(p.name)}</b><small style="color:rgba(255,255,255,.85)">${esc(p.tag || THEMES.find((t) => t.id === p.theme)?.name || "")} · ${esc(bandLabel(p.band))} · ${modulesOf(p.tree).length} module${modulesOf(p.tree).length > 1 ? "s" : ""}</small>
          <div class="sp-row" style="margin-top:8px"><button class="sp-btn sm" data-do="open">Ouvrir</button><button class="sp-btn sm icon" data-do="share" aria-label="Partager">${icon("share", 16)}</button><button class="sp-btn sm icon" data-do="del" aria-label="Supprimer">${icon("trash", 16)}</button></div></article>`).join("")}</div>`
        : '<div class="sp-panel sp-pad"><p class="sp-muted" style="margin:0">Aucune planète pour le moment. Crée la tienne en quelques clics : thème, design et modules sont proposés pour toi.</p></div>'}
      <details style="margin-top:16px"><summary class="sp-muted" style="cursor:pointer">Ajouter la planète d'un ami</summary><form id="at-imp" class="pl-ask" style="margin-top:8px"><input class="sp-input" id="at-code" placeholder="Colle le lien reçu" autocomplete="off" /><button class="sp-btn" type="submit">Ouvrir</button></form></details>`;
    $("#at-new").onclick = () => openWelcome({});
    $("#at-imp").onsubmit = (e) => {
      e.preventDefault();
      const raw = $("#at-code").value.trim();
      const code = raw.includes("planet=") ? new URLSearchParams(raw.split("?")[1] || "").get("planet") : raw;
      location.href = `${location.pathname}?planet=${encodeURIComponent(code || "")}`;
    };
    $("#at-view").onclick = async (e) => {
      const b = e.target.closest("[data-do]");
      const p = b && list.find((x) => x.id === b.closest("[data-id]").dataset.id);
      if (!p) return;
      if (b.dataset.do === "open") openPlanet(p);
      if (b.dataset.do === "share") {
        const link = `${location.origin}${location.pathname}?planet=${encodePlanet(p)}`;
        try {
          await navigator.clipboard.writeText(link);
          toast("Lien copié. Il ne contient aucune clé.");
        } catch {
          dialog({ title: "Lien de partage", body: `<input class="sp-input" readonly value="${esc(link)}" onfocus="this.select()" />` });
        }
      }
      if (b.dataset.do === "del" && (await confirmDialog(`Supprimer la planète « ${p.name} » ?`, { ok: "Supprimer", danger: true }))) {
        deletePlanet(p.id);
        render();
      }
    };
  }

  /* ---------- outils : guides d'installation ---------- */
  function viewTools() {
    const apiCards = CONNECTORS.map((c) => {
      const locked = c.minAge > profile.band;
      return `<article class="sp-panel sp-pad" data-conn="${c.id}" style="margin:0 0 10px;${locked ? "opacity:.6" : ""}">
        <div class="sp-row" style="justify-content:space-between"><b>${glyph(c.glyph, 18)} ${esc(c.name)}</b><span class="sp-row">${statusBadge("live")}<span class="sp-badge plain">${locked ? icon("lock", 12) : ""} Dès ${c.minAge} ans</span></span></div>
        <p class="sp-muted" style="margin:6px 0">${esc(c.about)}</p><small class="sp-muted">Licence : ${esc(c.license)}</small>
        <details style="margin-top:8px"><summary style="cursor:pointer">Guide d'installation</summary><ol class="sp-muted">${c.guide.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
          <p><a href="${esc(c.official)}" target="_blank" rel="noopener noreferrer" style="color:var(--sp-a)">Site officiel ↗</a> · <a href="${esc(c.terms)}" target="_blank" rel="noopener noreferrer" style="color:var(--sp-a)">Conditions ↗</a></p><p class="sp-muted">Limites : ${esc(c.limits)}</p></details>
        ${c.key ? `<div class="sp-row" style="margin-top:8px"><label class="sp-field" style="margin:0;flex:1;min-width:200px"><span>${esc(c.key.label)}</span><input class="sp-input" type="password" autocomplete="off" data-key="${c.key.id}" placeholder="${esc(c.key.demo ? `par défaut : ${c.key.demo}` : "colle ta clé")}" value="${esc(keys.get(c.key.id, ""))}" /></label><button class="sp-btn sm" data-save="${c.key.id}">Enregistrer</button><a class="sp-btn sm" href="${esc(c.key.signup)}" target="_blank" rel="noopener noreferrer">Obtenir une clé ↗</a></div>` : ""}
        <div class="sp-row" style="margin-top:10px"><button class="sp-btn sm" data-test="${c.id}" ${locked ? "disabled" : ""}>${icon("check", 14)}Tester</button><span class="sp-muted" data-out></span></div></article>`;
    }).join("");
    const gstate = google.isConfigured() ? "Activée sur cette installation." : "Pas encore activée : la messagerie et les fichiers fonctionnent en Démo (données d'exemple).";
    $("#at-view").innerHTML = `<h1 class="sp-h2">Outils et API</h1><p class="sp-muted">Chaque outil est une API officielle, gratuite et légale. Ouvre le guide pour l'installer, ajoute une clé si l'outil en accepte une, puis teste-le. Les clés restent sur cet appareil.</p>
      <h2 class="sp-eyebrow" style="margin-top:18px">Messagerie et fichiers personnels</h2>
      <article class="sp-panel sp-pad" style="margin:0 0 10px"><div class="sp-row" style="justify-content:space-between"><b>${icon("mail", 18)} Gmail et Google Drive</b>${statusBadge(google.isConfigured() ? "live" : "demo")}</div>
        <p class="sp-muted" style="margin:6px 0">${esc(gstate)} Lecture seule, jeton gardé en mémoire, adultes uniquement.</p>
        <details><summary style="cursor:pointer">Guide d'installation (pour le propriétaire du site)</summary><ol class="sp-muted"><li>Ouvre console.cloud.google.com et crée un projet.</li><li>Active les API « Gmail API » et « Google Drive API ».</li><li>Écran de consentement OAuth : type Externe, mode Test, ajoute les comptes de test.</li><li>Identifiants : crée un « ID client OAuth » de type Application Web et ajoute les origines JavaScript autorisées (le site publié et http://localhost:8092).</li><li>Copie l'ID client dans <code>js/config.js</code> (GOOGLE_CLIENT_ID). Il n'est pas secret.</li><li>Pour ouvrir à tout le monde, Google exige une validation de l'application (voir docs/GOOGLE.md).</li></ol></details></article>
      <h2 class="sp-eyebrow" style="margin-top:18px">Outils ouverts (${CONNECTORS.length})</h2>${apiCards}`;
    $("#at-view").onclick = async (e) => {
      const card = e.target.closest("[data-conn]");
      if (!card) return;
      const c = byId(card.dataset.conn);
      if (e.target.closest("[data-save]")) {
        keys.set(c.key.id, card.querySelector("[data-key]").value.trim().slice(0, 80));
        toast("Clé enregistrée sur cet appareil.");
      }
      if (e.target.closest("[data-test]")) {
        const out = card.querySelector("[data-out]");
        out.textContent = "Test en cours…";
        try {
          const r = await run(c, "discover", "", { band: c.minAge, key: c.key ? keys.get(c.key.id, "") : "" });
          out.textContent = r.length ? `Ça marche : ${r.length} résultat${r.length > 1 ? "s" : ""} (ex. « ${r[0].title.slice(0, 40)} »)` : "Répond, mais sans résultat.";
        } catch (err) {
          out.textContent = `Échec : ${err.message}`;
        }
      }
    };
  }

  /* ---------- profil ---------- */
  function viewMe() {
    $("#at-view").innerHTML = `<h1 class="sp-h2">Profil</h1><div class="sp-panel sp-pad"><div class="sp-field"><span>Ton âge</span><div class="sp-chips" id="me-b">${BANDS.map((b) => `<button class="sp-chip ${b.id === profile.band ? "on" : ""}" data-b="${b.id}">${esc(b.label)}</button>`).join("")}</div></div>
      <p class="sp-muted">Il adapte les outils, les recherches et les planètes que tu vois. Il est simplement déclaré pour l'instant (vérification prévue plus tard) et reste sur cet appareil.</p>
      <div class="sp-row"><button class="sp-btn" id="me-guide">${icon("book", 16)}Revoir le guide rapide</button></div></div>`;
    $("#me-b").onclick = async (e) => {
      const b = e.target.closest("[data-b]");
      if (!b) return;
      const n = Number(b.dataset.b);
      if (n > profile.band && profile.band < 13 && !(await confirmDialog("Un âge plus élevé ouvre plus de contenu. Un adulte doit être d'accord. Continuer ?", { ok: "Continuer" }))) return;
      profile.band = n;
      render();
    };
    $("#me-guide").onclick = () => showGuide(profile.band, "ta planète");
  }

  render();
  return { destroy: ui.destroy };
}

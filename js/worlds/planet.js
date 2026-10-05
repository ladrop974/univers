// Page d'une planète : arbre de dossiers / sous-dossiers, modules (fonctionnels ou démo), assistant de recherche, sources.
import { esc } from "./common.js";
import { glyph } from "../glyphs.js";
import { page, icon, statusBadge, toast, dialog, confirmDialog, promptDialog } from "../ui.js";
import { showGuide, guideButton } from "../guideui.js";
import { store } from "./common.js";
import { byId, run } from "../catalog.js";
import { bandLabel, effectiveBand, encodePlanet, cleanQuery } from "../policy.js";
import { MODULES, GROUPS, byModuleId, gameFallback } from "../modules.js";
import { makeFolder, makeModule, addNode, removeNode, renameNode, find, modulesOf, MAX_NODES } from "../planetmodel.js";
import { parse } from "../assistant.js";
import * as google from "../google.js";
import { profile, upsertPlanet, loadPlanets } from "../myplanets.js";

const keys = store("keys");
const when = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "");

export function open(root, ctx) {
  const { quit, openAtelier, openWelcome, openWorldById, playGame, games = [] } = ctx;
  let planet = ctx.arg.planet;
  const band = effectiveBand(planet.band, profile.band);
  let saved = loadPlanets().some((p) => p.id === planet.id);
  let sel = null; // id du nœud ouvert ; null = accueil de la planète
  let token = 0;
  const audio = new Audio();
  audio.preload = "none";
  let playing = null;

  const resolve = (id) => byModuleId(id) || (String(id).startsWith("game:") ? (() => { const g = games.find((x) => `game:${x.id}` === id); return g ? gameFallback(g) : null; })() : null);
  const persist = () => saved && upsertPlanet(planet);
  const setTree = (t) => {
    if (!t) return toast(`Limite atteinte (${MAX_NODES} éléments, 4 niveaux).`);
    planet = { ...planet, tree: t };
    persist();
    renderNav();
    renderPane();
  };

  const ui = page(root, {
    title: planet.name, glyph: planet.glyph, sub: planet.tag || `Planète ${bandLabel(band)}`, color: planet.color, color2: planet.color2, fx: matchMedia("(prefers-reduced-motion: reduce)").matches ? "aucun" : planet.fx, quit,
    actions: `${guideButton()}<button type="button" class="sp-btn sm" data-edit aria-label="Modifier le design">${icon("edit", 16)}<span class="lbl">Design</span></button><button type="button" class="sp-btn sm" data-share aria-label="Partager">${icon("share", 16)}<span class="lbl">Partager</span></button><button type="button" class="sp-btn sm" data-atelier aria-label="Atelier">${icon("orbit", 16)}<span class="lbl">Atelier</span></button>`,
  });
  ui.body.innerHTML = `<main class="sp-main">
    ${saved ? "" : `<div class="pl-banner info" id="pl-import">${icon("orbit", 20)}<span style="flex:1">Cette planète vient d'un lien. Ajoute-la à ton système pour la garder en orbite.</span><button type="button" class="sp-btn sm primary" id="pl-keep">Ajouter</button></div>`}
    <div class="sp-row" style="margin:0 0 12px"><span class="sp-badge live plain" title="Le contenu s'adapte à la tranche d'âge la plus jeune.">${icon("shield", 13)} Adaptée ${esc(bandLabel(band))}</span>
      ${band < planet.band ? `<span class="sp-muted">Prévue pour ${esc(bandLabel(planet.band))} : réduite à ton âge.</span>` : ""}</div>
    <form class="pl-ask" id="pl-ask"><input class="sp-input" id="pl-q" maxlength="120" autocomplete="off" placeholder="${band < 9 ? "Demande par exemple : lion, ou quel temps fait-il à Paris ?" : "Demande à ta planète : « ai-je reçu des mails ? », « quel temps à Paris ? », ou cherche…"}" />
      <button class="sp-btn primary" type="submit">${icon("spark", 16)}Demander</button></form>
    <div class="pl-answers" id="pl-answers"></div>
    <div class="pl-layout"><nav class="sp-panel pl-nav" id="pl-nav" aria-label="Contenu de la planète"></nav><section id="pl-pane" aria-live="polite"></section></div>
    <footer class="pl-foot" id="pl-foot"></footer></main>`;
  const $ = (s) => ui.body.querySelector(s);
  const bar = ui.top;

  /* ---------- navigation en arbre ---------- */
  function navNode(n, depth = 1) {
    if (n.type === "folder") {
      return `<div><div class="tr-node"><button type="button" class="tr-btn ${sel === n.id ? "on" : ""}" data-open="${n.id}">${icon("folder", 16)}<span>${esc(n.name)}</span></button><button type="button" class="tr-act" data-menu="${n.id}" aria-label="Actions pour ${esc(n.name)}">${icon("more", 16)}</button></div>
        <div class="tr-kids">${n.children.map((c) => navNode(c, depth + 1)).join("")}</div></div>`;
    }
    const m = resolve(n.mod);
    if (!m) return "";
    const locked = m.minAge > band;
    return `<div class="tr-node"><button type="button" class="tr-btn ${sel === n.id ? "on" : ""} ${locked ? "locked" : ""}" data-open="${n.id}">${locked ? icon("lock", 16) : `${glyph(m.glyph, 16)}`}<span>${esc(m.name)}</span></button><button type="button" class="tr-act" data-menu="${n.id}" aria-label="Actions pour ${esc(m.name)}">${icon("more", 16)}</button></div>`;
  }
  function renderNav() {
    $("#pl-nav").innerHTML = `<p class="sp-eyebrow" style="margin:4px 8px 6px">Ma planète</p>
      <div class="tr-node"><button type="button" class="tr-btn ${sel === null ? "on" : ""}" data-open="">${icon("home", 16)}<span>Accueil</span></button></div>
      ${planet.tree.map((n) => navNode(n)).join("")}
      <div class="sp-row" style="margin-top:10px;padding:0 4px"><button type="button" class="sp-btn sm" data-add="folder">${icon("plus", 14)}Dossier</button><button type="button" class="sp-btn sm" data-add="module">${icon("plus", 14)}Module</button></div>
      <p class="sp-muted" style="margin:8px 8px 2px;font-size:.78rem">${sel && find(planet.tree, sel)?.node.type === "folder" ? "Ajouts dans le dossier ouvert." : "Ajouts à la racine."}</p>`;
  }
  const currentParent = () => (sel && find(planet.tree, sel)?.node.type === "folder" ? sel : null);

  async function chooseModule() {
    const have = new Set(modulesOf(planet.tree));
    const extra = games.filter((g) => !MODULES.some((m) => m.id === `game:${g.id}`)).map(gameFallback);
    const body = GROUPS.map((g) => `<p class="sp-eyebrow" style="margin:14px 0 6px">${esc(g.label)}</p>${[...MODULES, ...extra].filter((m) => m.group === g.id).map((m) => {
      const ok = m.minAge <= band;
      return `<button type="button" class="wz-mod ${ok && !have.has(m.id) ? "" : "off"}" style="width:100%;text-align:left;color:inherit" data-add="${esc(m.id)}" ${ok && !have.has(m.id) ? "" : "disabled"}><span class="t"><span class="sp-row"><b>${glyph(m.glyph, 18)} ${esc(m.name)}</b>${ok ? statusBadge(m.status()) : `<span class="sp-badge plain">${icon("lock", 12)} Dès ${m.minAge} ans</span>`}${have.has(m.id) ? '<span class="sp-by">déjà ici</span>' : ""}</span><small class="sp-muted">${esc(m.about)}</small></span></button>`;
    }).join("")}`).join("");
    return dialog({ title: "Ajouter un module", wide: true, body: `<p class="sp-muted">Les modules verrouillés ne sont pas adaptés à l'âge de cette planète.</p>${body}`, actions: [{ label: "Fermer", value: null }], onMount: (el, close) => { el.onclick = (e) => { const b = e.target.closest("[data-add]"); if (b && !b.disabled) close(b.dataset.add); }; } });
  }
  async function addModule(id, parentId) {
    const m = resolve(id);
    if (!m) return;
    if (m.minAge > band) return toast(`Ce module est réservé à ${m.minAge} ans et plus.`);
    setTree(addNode(planet.tree, parentId, makeModule(id)));
    toast(`« ${m.name} » ajouté.`);
  }

  $("#pl-nav").onclick = async (e) => {
    const o = e.target.closest("[data-open]");
    if (o) {
      sel = o.dataset.open || null;
      renderNav();
      return renderPane();
    }
    const a = e.target.closest("[data-add]");
    if (a?.dataset.add === "folder") {
      const name = await promptDialog({ title: "Nouveau dossier", label: "Nom du dossier", ok: "Créer" });
      if (name) setTree(addNode(planet.tree, currentParent(), makeFolder(name)));
    } else if (a?.dataset.add === "module") {
      const id = await chooseModule();
      if (id) addModule(id, currentParent());
    }
    const mn = e.target.closest("[data-menu]");
    if (mn) nodeMenu(mn.dataset.menu);
  };
  async function nodeMenu(id) {
    const hit = find(planet.tree, id);
    if (!hit) return;
    const n = hit.node;
    const acts = n.type === "folder"
      ? [{ label: "Renommer", value: "rename" }, { label: "Sous-dossier", value: "sub" }, { label: "Module ici", value: "mod" }, { label: "Supprimer", value: "del", danger: true }]
      : [{ label: "Retirer", value: "del", danger: true }];
    const v = await dialog({ title: n.type === "folder" ? n.name : resolve(n.mod)?.name || "Module", body: `<p class="sp-muted">${n.type === "folder" ? "Dossier" : "Module"}</p>`, actions: [{ label: "Fermer", value: null }, ...acts] });
    if (v === "rename") {
      const name = await promptDialog({ title: "Renommer le dossier", label: "Nom", value: n.name });
      if (name) setTree(renameNode(planet.tree, id, name));
    } else if (v === "sub") {
      const name = await promptDialog({ title: "Nouveau sous-dossier", label: "Nom", ok: "Créer" });
      if (name) setTree(addNode(planet.tree, id, makeFolder(name)));
    } else if (v === "mod") {
      const mid = await chooseModule();
      if (mid) addModule(mid, id);
    } else if (v === "del" && (await confirmDialog(n.type === "folder" ? "Supprimer ce dossier et tout ce qu'il contient ?" : "Retirer ce module de la planète ?", { ok: n.type === "folder" ? "Supprimer" : "Retirer", danger: true }))) {
      if (sel === id) sel = null;
      setTree(removeNode(planet.tree, id));
    }
  }

  /* ---------- volet de contenu ---------- */
  const cardOf = (n) => {
    if (n.type === "folder") return `<button type="button" class="sp-card" data-open="${n.id}"><span class="ico">${icon("folder", 26)}</span><b>${esc(n.name)}</b><small>${n.children.length} élément${n.children.length > 1 ? "s" : ""}</small></button>`;
    const m = resolve(n.mod);
    if (!m) return "";
    const locked = m.minAge > band;
    return `<button type="button" class="sp-card ${locked ? "off" : ""}" data-open="${n.id}"><span class="ico">${glyph(m.glyph, 26)}</span><b>${esc(m.name)}</b><div class="sp-row">${locked ? `<span class="sp-badge plain">${icon("lock", 12)} Dès ${m.minAge} ans</span>` : statusBadge(m.status())}</div><p>${esc(m.about)}</p><span class="sp-by">${esc(m.by || "")}</span></button>`;
  };
  function renderPane() {
    const my = ++token;
    audio.pause();
    playing = null;
    const pane = $("#pl-pane");
    const hit = sel ? find(planet.tree, sel) : null;
    if (sel && !hit) sel = null;
    if (!hit) {
      pane.innerHTML = planet.tree.length
        ? `<h2 class="sp-h2">Accueil de ${esc(planet.name)}</h2><div class="sp-grid">${planet.tree.map(cardOf).join("")}</div>`
        : `<div class="sp-panel sp-pad"><h2 class="sp-h2">Ta planète est vide</h2><p class="sp-muted">Ajoute un module (outil, jeu, messagerie) ou crée un dossier pour t'organiser.</p><button type="button" class="sp-btn primary" id="pl-first">${icon("plus", 16)}Ajouter un module</button></div>`;
      pane.querySelector("#pl-first")?.addEventListener("click", async () => { const id = await chooseModule(); if (id) addModule(id, null); });
      return;
    }
    const n = hit.node;
    if (n.type === "folder") {
      pane.innerHTML = `<h2 class="sp-h2">${icon("folder", 20)} ${esc(n.name)}</h2>${n.children.length ? `<div class="sp-grid">${n.children.map(cardOf).join("")}</div>` : '<p class="sp-muted">Dossier vide. Utilise « Dossier » ou « Module » à gauche pour le remplir.</p>'}`;
      return;
    }
    const m = resolve(n.mod);
    const head = `<div class="sp-row" style="margin:0 0 4px"><h2 class="sp-h2" style="margin:0">${glyph(m.glyph, 22)} ${esc(m.name)}</h2>${m.minAge > band ? "" : statusBadge(m.status())}</div><p class="sp-muted" style="margin:0 0 14px">${esc(m.about)} <span class="sp-by">${esc(m.by || "")}</span></p>`;
    if (m.minAge > band) {
      pane.innerHTML = `${head}<div class="pl-banner">${icon("lock", 20)}<span>Ce module est réservé à ${m.minAge} ans et plus. Il n'est pas disponible pour cette planète.</span></div>`;
      return;
    }
    ({ api: viewApi, world: viewLaunch, game: viewLaunch, link: viewLaunch, google: viewGoogle })[m.kind](pane, m, head, my);
  }

  /* ---- module API : sélection du jour + recherche ---- */
  function viewApi(pane, m, head, my) {
    const c = byId(m.conn);
    const canSearch = c.search && c.searchMinAge <= band;
    pane.innerHTML = `${head}${canSearch ? `<form class="pl-ask" id="mod-q"><input class="sp-input" maxlength="60" placeholder="Rechercher…" autocomplete="off" /><button class="sp-btn" type="submit">${icon("search", 16)}Chercher</button></form>` : '<p class="sp-muted">À ton âge, ce module propose des sélections choisies (pas de recherche libre).</p>'}<div id="mod-st" class="sp-muted" role="status"></div><div id="mod-res"></div>`;
    const load = async (mode, q) => {
      const st = pane.querySelector("#mod-st"), res = pane.querySelector("#mod-res");
      st.textContent = mode === "search" ? "Recherche…" : "Chargement…";
      res.innerHTML = "";
      try {
        const items = await run(c, mode, q, { band, key: c.key ? keys.get(c.key.id, "") : "" });
        if (my !== token) return;
        st.textContent = items.length ? (mode === "search" ? `${items.length} résultat${items.length > 1 ? "s" : ""}` : "") : "Aucun résultat.";
        res.innerHTML = `<div class="pl-res-grid">${items.map(itemCard).join("")}</div>`;
      } catch (e) {
        if (my === token) st.textContent = /adaptée|lettres|liens/.test(e.message) ? e.message : `Ce module ne répond pas pour l'instant (${e.message}). Réessaie plus tard.`;
      }
    };
    pane.querySelector("#mod-q")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = e.target.querySelector("input").value;
      load(q.trim() ? "search" : "discover", q);
    });
    load("discover", "");
  }
  function itemCard(it) {
    if (it.kind === "quiz") return `<article class="pl-it pl-quiz" data-correct="${esc(it.correct)}"><b>${esc(it.q)}</b><small>Quiz en anglais</small><div class="pl-opts">${it.answers.map((a) => `<button type="button" data-a="${esc(a)}">${esc(a)}</button>`).join("")}</div></article>`;
    const vis = it.img ? `<img loading="lazy" referrerpolicy="no-referrer" alt="" src="${esc(it.img)}" />` : it.glyph ? `<div class="emo">${glyph(it.glyph, 44)}</div>` : "";
    return `<article class="pl-it">${vis}<b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}<div class="sp-row">${it.audio ? `<button type="button" class="sp-btn sm" data-audio="${esc(it.audio)}">${icon("play", 14)}Écouter</button>` : ""}${it.url ? `<a class="sp-btn sm" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${icon("ext", 14)}Source</a>` : ""}</div><span class="src">${esc(it.source)}${it.credit ? " · " + esc(it.credit) : ""}</span></article>`;
  }

  /* ---- jeux, mondes, liens : lancement ---- */
  function viewLaunch(pane, m, head) {
    const btn = m.kind === "link" ? `<a class="sp-btn primary" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${icon("ext", 16)}Ouvrir dans un nouvel onglet</a>` : `<button type="button" class="sp-btn primary" id="mod-go">${icon("play", 16)}${m.kind === "game" ? "Jouer" : "Ouvrir"}</button>`;
    pane.innerHTML = `${head}<div class="sp-panel sp-pad"><p style="margin:0 0 12px">${m.kind === "link" ? "Cette fonction vit dans l'application SolunIA Network, créée par un Soluniarien. Elle s'ouvre à part." : "Créé par un Soluniarien et déjà inclus dans Univers : il fonctionne tel quel."}</p>${btn}</div>`;
    pane.querySelector("#mod-go")?.addEventListener("click", () => (m.kind === "game" ? playGame(m.gameId) : openWorldById(m.worldId)));
  }

  /* ---- Gmail / Drive ---- */
  async function connectFlow(kind) {
    const label = kind === "mail" ? "ton Gmail" : "ton Google Drive";
    const ok = await dialog({
      title: "Connecter Google", accent: planet.color,
      body: `<p>Tu vas autoriser Univers à lire ${esc(label)} <b>en lecture seule</b>.</p><ul class="sp-muted"><li>Seuls les en-têtes sont lus (expéditeur, objet, date) ou les noms de fichiers : jamais le contenu.</li><li>L'accès reste dans ce navigateur, en mémoire. Il disparaît à la fermeture ou à la déconnexion.</li><li>Rien n'est stocké, envoyé ailleurs ni inclus dans un lien de partage.</li><li>La fenêtre qui s'ouvre est celle de Google : tu peux refuser ou retirer l'accès à tout moment.</li></ul>`,
      actions: [{ label: "Annuler", value: false }, { label: "Continuer vers Google", value: true, primary: true }],
    });
    if (!ok) return false;
    try {
      await google.connect(kind);
      toast("Compte Google connecté.");
      return true;
    } catch (e) {
      toast(e.message);
      return false;
    }
  }
  async function viewGoogle(pane, m, head, my) {
    const kind = m.gkind;
    const connected = google.isConnected(kind);
    const banner = connected ? `<div class="pl-banner info">${icon("shield", 20)}<span style="flex:1">Connecté en lecture seule. Rien n'est enregistré.</span><button type="button" class="sp-btn sm" id="g-out">Déconnecter</button></div>`
      : `<div class="pl-banner">${icon("spark", 20)}<span style="flex:1"><b>Démo</b> : ces données sont des exemples, pas les tiens. ${google.isConfigured() ? "Connecte ton compte pour voir les vraies." : "La connexion Google réelle n'est pas encore activée sur cette installation (voir docs/GOOGLE.md)."}</span>${google.isConfigured() ? '<button type="button" class="sp-btn sm primary" id="g-in">Connecter</button>' : ""}</div>`;
    pane.innerHTML = `${head}${banner}<div id="g-data" class="sp-muted">Chargement…</div>`;
    pane.querySelector("#g-in")?.addEventListener("click", async () => { if (await connectFlow(kind)) renderPane(); });
    pane.querySelector("#g-out")?.addEventListener("click", () => { google.disconnect(kind); toast("Déconnecté de Google."); renderPane(); });
    try {
      const d = kind === "mail" ? (connected ? await google.mailSummary() : google.DEMO_MAIL) : connected ? await google.driveSearch("") : google.DEMO_DRIVE;
      if (my === token) pane.querySelector("#g-data").innerHTML = googleHtml(kind, d);
    } catch (e) {
      if (my === token) pane.querySelector("#g-data").textContent = e.message;
    }
  }
  const googleHtml = (kind, d) => kind === "mail"
    ? `<div class="sp-panel sp-pad"><p style="margin:0 0 8px;color:var(--sp-text)"><b>${d.unread}</b> mail${d.unread > 1 ? "s" : ""} non lu${d.unread > 1 ? "s" : ""}${d.demo ? " (exemple)" : ""}</p>${d.items.map((i) => `<div class="sp-row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--sp-line)"><span style="color:var(--sp-text)">${i.unread ? "● " : ""}<b>${esc(i.from)}</b> : ${esc(i.subject)}</span><small>${esc(when(i.date))}</small></div>`).join("")}</div>`
    : `<div class="sp-panel sp-pad">${d.items.length ? d.items.map((f) => `<div class="sp-row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--sp-line)"><span style="color:var(--sp-text)">${icon("drive", 16)} ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" style="color:inherit">${esc(f.name)}</a>` : esc(f.name)}</span><small>${esc(when(f.modified))}</small></div>`).join("") : "Aucun fichier."}</div>`;

  /* ---------- assistant ---------- */
  const answers = () => $("#pl-answers");
  const block = (title, bodyHtml, status) => `<article class="sp-panel pl-ans"><h4>${esc(title)} ${status ? statusBadge(status) : ""}</h4>${bodyHtml}</article>`;
  const need = (modId, why) => {
    const m = byModuleId(modId);
    if (m.minAge > band) return block(m.name, `<p class="sp-muted">${esc(why)} Ce module est réservé à ${m.minAge} ans et plus.</p>`);
    return block(m.name, `<p class="sp-muted">${esc(why)}</p><button type="button" class="sp-btn sm primary" data-need="${modId}">${icon("plus", 14)}Ajouter « ${esc(m.name)} » à ma planète</button>`);
  };
  async function ask(question) {
    const el = answers();
    el.innerHTML = block("Recherche…", '<p class="sp-muted">Je regarde dans ta planète.</p>');
    const have = new Set(modulesOf(planet.tree));
    const out = [];
    for (const it of parse(question)) {
      try {
        if (it.kind === "weather") {
          if (!have.has("api:openmeteo")) out.push(need("api:openmeteo", "Pour donner la météo, il me faut ce module."));
          else if (!it.city) out.push(block("Météo", '<p class="sp-muted">Précise une ville, par exemple : « quel temps fait-il à Paris ? ».</p>'));
          else {
            const r = await run(byId("openmeteo"), "search", it.city, { band });
            out.push(block(`Météo : ${it.city}`, r.length ? `<ul>${r.map((x) => `<li>${glyph(x.glyph || "cloudsun", 16)} <b>${esc(x.title)}</b> : ${esc(x.sub)}</li>`).join("")}</ul>` : '<p class="sp-muted">Je ne trouve pas cette ville.</p>', "live"));
          }
        } else if (it.kind === "mail") {
          if (!have.has("google:mail")) out.push(need("google:mail", "Pour lire tes mails, il me faut le module de messagerie."));
          else {
            const d = google.isConnected("mail") ? await google.mailSummary() : google.DEMO_MAIL;
            out.push(block("Messagerie", `<p style="margin:0 0 6px;color:var(--sp-text)">${d.demo ? "Exemple : " : ""}${d.unread ? `tu as <b>${d.unread}</b> mail${d.unread > 1 ? "s" : ""} non lu${d.unread > 1 ? "s" : ""}.` : "aucun mail non lu."}</p><ul>${d.items.slice(0, 3).map((i) => `<li>${esc(i.from)} : ${esc(i.subject)}</li>`).join("")}</ul>${d.demo ? '<p class="sp-muted">Connecte ton Gmail dans le module pour des données réelles.</p>' : ""}`, d.demo ? "demo" : "live"));
          }
        } else if (it.kind === "drive") {
          if (!have.has("google:drive")) out.push(need("google:drive", "Pour chercher dans tes fichiers, il me faut le module Drive."));
          else {
            const d = google.isConnected("drive") ? await google.driveSearch(it.q) : google.DEMO_DRIVE;
            out.push(block(`Fichiers${it.q ? ` : « ${it.q} »` : ""}`, d.items.length ? `<ul>${d.items.map((f) => `<li>${esc(f.name)} <small>${esc(when(f.modified))}</small></li>`).join("")}</ul>` : '<p class="sp-muted">Aucun fichier trouvé.</p>', d.demo ? "demo" : "live"));
          }
        } else {
          const c = cleanQuery(it.q, band);
          if (!c.ok) out.push(block("Recherche", `<p class="sp-muted">${esc(c.reason)}</p>`));
          else {
            const mods = planet.tree && modulesOf(planet.tree).map(resolve).filter((m) => m?.kind === "api" && m.minAge <= band && byId(m.conn).search && byId(m.conn).searchMinAge <= band);
            if (!mods.length) out.push(block("Recherche", '<p class="sp-muted">Aucun module de recherche adapté à ton âge dans cette planète. Ajoute-en un depuis la navigation.</p>'));
            const sets = await Promise.allSettled(mods.map((m) => run(byId(m.conn), "search", c.q, { band, key: byId(m.conn).key ? keys.get(byId(m.conn).key.id, "") : "" })));
            sets.forEach((r, i) => {
              if (r.status === "fulfilled" && r.value.length) out.push(block(mods[i].name, `<div class="pl-res-grid">${r.value.slice(0, 6).map(itemCard).join("")}</div>`, "live"));
            });
            if (mods.length && !out.length) out.push(block("Recherche", `<p class="sp-muted">Aucun résultat pour « ${esc(c.q)} ».</p>`));
          }
        }
      } catch (e) {
        out.push(block("Oups", `<p class="sp-muted">${esc(e.message)}</p>`));
      }
    }
    el.innerHTML = out.join("");
  }
  $("#pl-ask").onsubmit = (e) => {
    e.preventDefault();
    const q = $("#pl-q").value.trim();
    if (q) ask(q);
  };
  $("#pl-answers").onclick = (e) => {
    const n = e.target.closest("[data-need]");
    if (n) addModule(n.dataset.need, null).then(() => ask($("#pl-q").value));
  };

  /* ---------- interactions communes (audio, quiz) ---------- */
  ui.body.addEventListener("error", (e) => e.target.tagName === "IMG" && e.target.remove(), true);
  ui.body.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]");
    if (a) {
      const q = a.closest(".pl-quiz");
      if (q.dataset.done) return;
      q.dataset.done = "1";
      q.querySelectorAll("[data-a]").forEach((b) => b.classList.add(b.dataset.a === q.dataset.correct ? "good" : b.dataset.a === a.dataset.a ? "bad" : "dim"));
      toast(a.dataset.a === q.dataset.correct ? "Bonne réponse !" : `Raté ! C'était : ${q.dataset.correct}`);
      return;
    }
    const p = e.target.closest("[data-audio]");
    if (!p) return;
    if (playing === p) {
      audio.pause();
      p.innerHTML = `${icon("play", 14)}Écouter`;
      playing = null;
      return;
    }
    if (playing) playing.innerHTML = `${icon("play", 14)}Écouter`;
    audio.src = p.dataset.audio;
    audio.play().catch(() => toast("Ce son n'a pas pu être lu."));
    p.innerHTML = `${icon("pause", 14)}Pause`;
    playing = p;
  });
  audio.onended = () => {
    if (playing) playing.innerHTML = `${icon("play", 14)}Écouter`;
    playing = null;
  };

  /* ---------- barre d'actions, pied de page ---------- */
  bar.onclick = async (e) => {
    if (e.target.closest("[data-guide]")) showGuide(band, planet.name, planet.color);
    if (e.target.closest("[data-atelier]")) openAtelier();
    if (e.target.closest("[data-edit]")) openWelcome({ edit: planet });
    if (e.target.closest("[data-share]")) {
      const link = `${location.origin}${location.pathname}?planet=${encodePlanet(planet)}`;
      try {
        await navigator.clipboard.writeText(link);
        toast("Lien copié. Il ne contient aucune clé ni donnée privée.");
      } catch {
        dialog({ title: "Lien de partage", body: `<input class="sp-input" readonly value="${esc(link)}" onfocus="this.select()" />`, actions: [{ label: "Fermer", value: true, primary: true }] });
      }
    }
  };
  $("#pl-keep")?.addEventListener("click", () => {
    if (!upsertPlanet(planet)) return toast("12 planètes maximum : supprime-en une depuis l'Atelier.");
    saved = true;
    $("#pl-import").remove();
    toast("Planète ajoutée à ton système.");
  });
  const apis = modulesOf(planet.tree).map(resolve).filter((m) => m?.kind === "api").map((m) => byId(m.conn));
  $("#pl-foot").innerHTML = `${apis.length ? `<b>Sources et licences</b><ul>${apis.map((c) => `<li>${esc(c.attribution)} · <a href="${esc(c.terms)}" target="_blank" rel="noopener noreferrer">conditions</a></li>`).join("")}</ul>` : ""}<p>Les filtres d'âge sont une aide, pas une garantie : un adulte doit rester présent avec les plus jeunes.</p>`;

  renderNav();
  renderPane();
  if (ctx.arg.welcome) $("#pl-q").focus();
  return {
    destroy() {
      token++;
      audio.pause();
      audio.removeAttribute("src");
      ui.destroy();
    },
  };
}

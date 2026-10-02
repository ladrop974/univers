// Planète JEUX « Arcadia Prime » : les jeux faits par des Soluniariens, puis le reste du monde du jeu.
// Données : catalogue d'Univers (games/index.json), Free-to-Game, PokéAPI (gratuits, sans clé) et RAWG (clé gratuite à coller).
import { esc, store, getJSON, shell } from "./common.js";

const F2P = "https://www.freetogame.com/api/games?sort-by=popularity";
const POKE = "https://pokeapi.co/api/v2";
const ART = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const RAWG = "https://api.rawg.io/api/games";
const GENS = [[1, 151, "Gén. 1"], [152, 251, "Gén. 2"], [252, 386, "Gén. 3"], [387, 493, "Gén. 4"], [494, 649, "Gén. 5"], [650, 721, "Gén. 6"], [722, 809, "Gén. 7"], [810, 905, "Gén. 8"], [906, 1025, "Gén. 9"]];
const TYPES_FR = { normal: "Normal", fire: "Feu", water: "Eau", electric: "Électrik", grass: "Plante", ice: "Glace", fighting: "Combat", poison: "Poison", ground: "Sol", flying: "Vol", psychic: "Psy", bug: "Insecte", rock: "Roche", ghost: "Spectre", dragon: "Dragon", dark: "Ténèbres", steel: "Acier", fairy: "Fée" };
const STATS_FR = { hp: "PV", attack: "Attaque", defense: "Défense", "special-attack": "Att. spé.", "special-defense": "Déf. spé.", speed: "Vitesse" };
const RAWG_GENRES = [["", "Tous"], ["action", "Action"], ["adventure", "Aventure"], ["role-playing-games-rpg", "RPG"], ["strategy", "Stratégie"], ["shooter", "Tir"], ["puzzle", "Réflexion"], ["racing", "Course"], ["sports", "Sport"], ["indie", "Indé"]];

export function open(root, { quit, playGame, games = [] }) {
  const ui = shell(root, { title: "Arcadia Prime", sub: "Tous les mondes du jeu", accent: "#f472b6", quit });
  const st = store("games");
  let tab = st.get("tab", "sol");
  let dead = false;
  const cache = {};

  ui.body.innerHTML = `
    <div class="gm-hero"><canvas id="gm-cv"></canvas></div>
    <div class="rd-tabs gm-tabs" id="gm-tabs">
      <button data-t="sol" type="button">🧑‍🚀 Soluniariens</button>
      <button data-t="f2p" type="button">🆓 Free-to-Game</button>
      <button data-t="poke" type="button">🔴 Pokédex</button>
      <button data-t="rawg" type="button">🎲 RAWG</button>
    </div>
    <section id="gm-view"></section>
    <div class="lb-modal" id="gm-modal" hidden></div>`;
  const $ = (s) => ui.body.querySelector(s);
  const view = () => $("#gm-view");
  const modal = (html) => {
    const m = $("#gm-modal");
    m.hidden = false;
    m.innerHTML = `<div class="lb-sheet"><button class="lb-x" type="button" aria-label="Fermer">✕</button>${html}</div>`;
    const close = () => {
      m.hidden = true;
      m.innerHTML = "";
    };
    m.querySelector(".lb-x").onclick = close;
    m.onclick = (e) => e.target === m && close();
    return m;
  };

  $("#gm-tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (b) show(b.dataset.t);
  };
  function show(t) {
    tab = t;
    st.set("tab", t);
    for (const b of $("#gm-tabs").children) b.classList.toggle("on", b.dataset.t === t);
    ({ sol, f2p, poke, rawg })[t]();
  }

  /* ---------- 1. Créés par des Soluniariens ---------- */
  function sol() {
    view().innerHTML = `<h3>Créés par des Soluniariens</h3>
      <p class="muted">Des jeux écrits par la communauté (avec Claude Code), jouables tout de suite, seul, à deux ou en duel par lien.</p>
      <div class="gm-grid">${games
        .map(
          (g) => `<button type="button" class="gm-card gm-sol" data-id="${esc(g.id)}">
            <span class="gm-emo">${esc(g.emoji || "🎮")}</span><b>${esc(g.name)}</b>
            <small>${esc(g.tagline || "")}</small><em>${esc(g.players || "")}${g.author ? " · par " + esc(g.author) : ""}</em></button>`,
        )
        .join("")}
        <a class="gm-card gm-add" href="https://github.com/ladrop974/univers/blob/main/docs/AJOUTER_UN_JEU.md" target="_blank" rel="noopener noreferrer">
          <span class="gm-emo">➕</span><b>Ajoute ton jeu</b><small>Un dossier + une ligne : Claude Code l'écrit pour toi.</small><em>Guide ↗</em></a></div>`;
    view().onclick = (e) => {
      const c = e.target.closest(".gm-sol");
      if (c) playGame?.(c.dataset.id);
    };
  }

  /* ---------- 2. Free-to-Game ---------- */
  async function f2p() {
    view().innerHTML = `<h3>Free-to-Game</h3><p class="muted">Des jeux gratuits (PC et navigateur), triés par popularité.</p>
      <form class="rd-search"><input id="f-q" placeholder="Chercher un jeu…" autocomplete="off" /><button type="submit">Chercher</button></form>
      <div class="chips" id="f-genres"></div><div class="rd-status muted" id="f-status">Chargement du catalogue…</div>
      <div class="gm-grid" id="f-grid"></div><button class="lb-more" id="f-more" type="button" hidden>Voir la suite</button>`;
    let all = cache.f2p;
    if (!all) {
      try {
        all = await getJSON(F2P, 25000);
        cache.f2p = all;
      } catch {
        if (!dead && tab === "f2p") $("#f-status").textContent = "Le catalogue ne répond pas. Réessaie dans un instant.";
        return;
      }
    }
    if (dead || tab !== "f2p") return;
    let genre = "", text = "", shown = 24;
    const genres = [...new Set(all.map((g) => g.genre))].sort();
    $("#f-genres").innerHTML = genres.map((g) => `<button type="button" data-v="${esc(g)}">${esc(g)}</button>`).join("");
    const draw = () => {
      const rows = all.filter((g) => (!genre || g.genre === genre) && (!text || g.title.toLowerCase().includes(text)));
      $("#f-status").textContent = `${rows.length} jeux`;
      $("#f-grid").innerHTML = rows
        .slice(0, shown)
        .map((g) => `<a class="gm-card" href="${esc(g.game_url)}" target="_blank" rel="noopener noreferrer">
          <img src="${esc(g.thumbnail)}" alt="" loading="lazy" /><b>${esc(g.title)}</b>
          <small>${esc(g.short_description)}</small><em>${esc(g.genre)} · ${esc(g.platform)}</em></a>`)
        .join("");
      $("#f-more").hidden = rows.length <= shown;
    };
    $("#f-genres").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      genre = genre === b.dataset.v ? "" : b.dataset.v;
      for (const x of $("#f-genres").children) x.classList.toggle("on", x.dataset.v === genre);
      shown = 24;
      draw();
    };
    view().querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      text = $("#f-q").value.trim().toLowerCase();
      shown = 24;
      draw();
    };
    $("#f-more").onclick = () => {
      shown += 24;
      draw();
    };
    draw();
  }

  /* ---------- 3. Pokédex ---------- */
  async function poke() {
    let gen = st.get("gen", 0), type = "", text = "", caught = st.get("caught", []);
    view().innerHTML = `<h3>Pokédex</h3><p class="muted">Tous les Pokémon, par génération et par type. Marque ceux que tu as « capturés ».</p>
      <form class="rd-search"><input id="p-q" placeholder="Nom ou numéro…" autocomplete="off" /><button type="submit">Chercher</button></form>
      <div class="chips" id="p-gens"></div><div class="chips" id="p-types"></div>
      <div class="rd-status muted" id="p-status"></div><div class="gm-grid gm-poke" id="p-grid"></div>`;
    $("#p-gens").innerHTML = GENS.map(([, , l], i) => `<button type="button" data-v="${i}" class="${i === gen ? "on" : ""}">${l}</button>`).join("");
    $("#p-types").innerHTML = Object.entries(TYPES_FR).map(([k, l]) => `<button type="button" data-v="${k}">${l}</button>`).join("");
    const idOf = (u) => +u.split("/").filter(Boolean).pop();
    async function load() {
      const [a, b] = GENS[gen];
      $("#p-status").textContent = "Chargement…";
      let rows;
      try {
        if (type) {
          const d = (cache["t" + type] ||= await getJSON(`${POKE}/type/${type}`));
          rows = d.pokemon.map((p) => ({ id: idOf(p.pokemon.url), name: p.pokemon.name })).filter((p) => p.id >= a && p.id <= b);
        } else {
          const d = (cache["g" + gen] ||= await getJSON(`${POKE}/pokemon?limit=${b - a + 1}&offset=${a - 1}`));
          rows = d.results.map((p) => ({ id: idOf(p.url), name: p.name }));
        }
      } catch {
        if (!dead && tab === "poke") $("#p-status").textContent = "Le Pokédex ne répond pas. Réessaie dans un instant.";
        return;
      }
      if (dead || tab !== "poke") return;
      rows.sort((x, y) => x.id - y.id);
      if (text) rows = rows.filter((p) => p.name.includes(text) || String(p.id) === text);
      $("#p-status").textContent = `${rows.length} Pokémon · ${caught.length} capturés`;
      $("#p-grid").innerHTML = rows
        .map((p) => `<button type="button" class="gm-card gm-pk ${caught.includes(p.id) ? "got" : ""}" data-id="${p.id}"><img src="${ART(p.id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><small>#${String(p.id).padStart(4, "0")}</small><b>${esc(p.name)}</b></button>`)
        .join("");
    }
    $("#p-gens").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      gen = +b.dataset.v;
      st.set("gen", gen);
      for (const x of $("#p-gens").children) x.classList.toggle("on", +x.dataset.v === gen);
      load();
    };
    $("#p-types").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      type = type === b.dataset.v ? "" : b.dataset.v;
      for (const x of $("#p-types").children) x.classList.toggle("on", x.dataset.v === type);
      load();
    };
    view().querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      text = $("#p-q").value.trim().toLowerCase();
      if (/^\d+$/.test(text)) {
        const n = +text;
        const gi = GENS.findIndex(([a, b]) => n >= a && n <= b);
        if (gi < 0) return ui.toast("Numéro hors du Pokédex (1 à 1025).");
        gen = gi;
        for (const x of $("#p-gens").children) x.classList.toggle("on", +x.dataset.v === gen);
      }
      load();
    };
    $("#p-grid").onclick = (e) => {
      const c = e.target.closest(".gm-pk");
      if (c) pokeDetail(+c.dataset.id);
    };
    async function pokeDetail(id) {
      const m = modal(`<p class="muted">Ouverture du dossier #${id}…</p>`);
      try {
        const [d, sp] = await Promise.all([getJSON(`${POKE}/pokemon/${id}`), getJSON(`${POKE}/pokemon-species/${id}`)]);
        if (dead || m.hidden) return;
        const fr = sp.names.find((n) => n.language.name === "fr")?.name || d.name;
        const desc = (sp.flavor_text_entries.find((f) => f.language.name === "fr") || sp.flavor_text_entries.find((f) => f.language.name === "en"))?.flavor_text.replace(/[\n\f]/g, " ") || "";
        const got = () => caught.includes(id);
        m.querySelector(".lb-sheet").innerHTML = `<button class="lb-x" type="button" aria-label="Fermer">✕</button>
          <div class="lb-sheet-top"><img src="${ART(id)}" alt="" /><div><h2>${esc(fr)} <small class="muted">#${String(id).padStart(4, "0")}</small></h2>
          <p>${d.types.map((t) => `<span class="gm-type">${esc(TYPES_FR[t.type.name] || t.type.name)}</span>`).join(" ")}</p>
          <p class="muted">${(d.height / 10).toFixed(1)} m · ${(d.weight / 10).toFixed(1)} kg</p><p class="lb-desc muted">${esc(desc)}</p>
          <div class="row"><button type="button" id="p-got">${got() ? "✓ Capturé" : "⚪ Capturer"}</button></div></div></div>
          <div class="gm-stats">${d.stats.map((s) => `<div><span>${esc(STATS_FR[s.stat.name] || s.stat.name)}</span><i style="--v:${Math.min(100, (s.base_stat / 180) * 100)}%"></i><b>${s.base_stat}</b></div>`).join("")}</div>`;
        const close = () => {
          m.hidden = true;
          m.innerHTML = "";
        };
        m.querySelector(".lb-x").onclick = close;
        m.querySelector("#p-got").onclick = (e) => {
          caught = got() ? caught.filter((x) => x !== id) : [...caught, id];
          st.set("caught", caught);
          e.target.textContent = got() ? "✓ Capturé" : "⚪ Capturer";
          $("#p-grid .gm-pk[data-id='" + id + "']")?.classList.toggle("got", got());
        };
      } catch {
        if (!m.hidden) m.querySelector(".lb-sheet").insertAdjacentHTML("beforeend", `<p class="muted">Dossier indisponible pour l'instant.</p>`);
      }
    }
    load();
  }

  /* ---------- 4. RAWG (clé gratuite) ---------- */
  async function rawg() {
    let key = st.get("rawgKey", "");
    if (!key) {
      view().innerHTML = `<h3>RAWG : 500 000 jeux</h3>
        <p class="muted">RAWG demande une clé gratuite (1 minute, sur <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer">rawg.io/apidocs</a>). Colle-la ici : elle reste sur ton appareil et n'est envoyée qu'à RAWG.</p>
        <form class="rd-search" id="r-key"><input id="r-k" placeholder="Ta clé RAWG" autocomplete="off" spellcheck="false" /><button type="submit">Enregistrer</button></form>`;
      $("#r-key").onsubmit = (e) => {
        e.preventDefault();
        const k = $("#r-k").value.trim();
        if (!/^[A-Za-z0-9]{16,64}$/.test(k)) return ui.toast("Cette clé n'a pas le bon format.");
        st.set("rawgKey", k);
        rawg();
      };
      return;
    }
    let genre = "", text = "", page = 1;
    view().innerHTML = `<h3>RAWG : 500 000 jeux</h3>
      <form class="rd-search"><input id="r-q" placeholder="Chercher un jeu…" autocomplete="off" /><button type="submit">Chercher</button></form>
      <div class="chips" id="r-genres"></div><div class="rd-status muted" id="r-status"></div>
      <div class="gm-grid" id="r-grid"></div><button class="lb-more" id="r-more" type="button" hidden>Voir la suite</button>
      <p class="muted">Données <a href="https://rawg.io" target="_blank" rel="noopener noreferrer">RAWG</a> · <button type="button" class="gm-link" id="r-reset">Changer de clé</button></p>`;
    $("#r-genres").innerHTML = RAWG_GENRES.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === "" ? "on" : ""}">${l}</button>`).join("");
    async function go(append) {
      $("#r-status").textContent = "Recherche…";
      const p = new URLSearchParams({ key, page_size: "24", page: String(page), ordering: text ? "-relevance" : "-added" });
      if (text) p.set("search", text);
      if (genre) p.set("genres", genre);
      try {
        const d = await getJSON(`${RAWG}?${p}`, 20000);
        if (dead || tab !== "rawg") return;
        $("#r-status").textContent = `${d.count.toLocaleString("fr-FR")} jeux`;
        const html = d.results
          .map((g) => `<a class="gm-card" href="https://rawg.io/games/${esc(g.slug)}" target="_blank" rel="noopener noreferrer">
            ${g.background_image ? `<img src="${esc(g.background_image)}" alt="" loading="lazy" />` : ""}<b>${esc(g.name)}</b>
            <small>${g.rating ? "★ " + g.rating.toFixed(1) + " · " : ""}${esc(g.released || "")}</small><em>${esc((g.genres || []).slice(0, 3).map((x) => x.name).join(", "))}</em></a>`)
          .join("");
        $("#r-grid").insertAdjacentHTML(append ? "beforeend" : "afterbegin", html);
        $("#r-more").hidden = !d.next;
      } catch (e) {
        if (dead || tab !== "rawg") return;
        const bad = /401|403/.test(String(e.message));
        $("#r-status").textContent = bad ? "Clé refusée par RAWG : vérifie-la (« Changer de clé »)." : "RAWG ne répond pas. Réessaie dans un instant.";
      }
    }
    $("#r-genres").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      genre = b.dataset.v;
      for (const x of $("#r-genres").children) x.classList.toggle("on", x.dataset.v === genre);
      page = 1;
      $("#r-grid").innerHTML = "";
      go(false);
    };
    view().querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      text = $("#r-q").value.trim();
      page = 1;
      $("#r-grid").innerHTML = "";
      go(false);
    };
    $("#r-more").onclick = () => {
      page++;
      go(true);
    };
    $("#r-reset").onclick = () => {
      st.set("rawgKey", "");
      rawg();
    };
    go(false);
  }

  /* ---------- planète animée : manettes et invaders en orbite ---------- */
  const cv = $("#gm-cv");
  const g = cv.getContext("2d");
  let raf = 0;
  const fit = () => {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.max(1, cv.clientWidth * d);
    cv.height = Math.max(1, cv.clientHeight * d);
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(cv);
  const frame = (t) => {
    const w = cv.width, h = cv.height, cx = w / 2, cy = h * 0.55, R = Math.min(w * 0.15, h * 0.42), s = t / 1000;
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
    grd.addColorStop(0, "#fbcfe8");
    grd.addColorStop(0.55, "#db2777");
    grd.addColorStop(1, "#4a0d2f");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, R, 0, 7);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.85)";
    const px = Math.round(R / 7);
    const inv = ["0110110", "1111111", "1011101", "0111110", "0100010"];
    inv.forEach((row, y) => [...row].forEach((c, x) => c === "1" && g.fillRect(cx - 3.5 * px + x * px, cy - 2.5 * px + y * px, px - 1, px - 1)));
    for (let i = 0; i < 8; i++) {
      const a = s * 0.5 + (i / 8) * 6.283, rx = R * 1.8, ry = R * 0.4;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      g.globalAlpha = Math.sin(a) > 0 ? 1 : 0.5;
      g.fillStyle = `hsl(${i * 45} 80% 65%)`;
      if (i % 2) {
        g.fillRect(x - 9, y - 5, 18, 10);
        g.fillStyle = "#111";
        g.fillRect(x - 6, y - 1, 5, 2);
        g.fillRect(x - 4, y - 3, 1, 6);
      } else {
        g.beginPath();
        g.arc(x, y, 6, 0, 7);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  show(tab);
  return {
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      ui.destroy();
    },
  };
}

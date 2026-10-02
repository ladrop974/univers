// Planète JEUX « Arcadia Prime » : les jeux faits par des Soluniariens, puis le reste du monde du jeu.
// Données : catalogue d'Univers (games/index.json), Free-to-Game (gratuit, sans clé) et RAWG (clé gratuite à coller).
import { esc, store, getJSON, shell } from "./common.js";

const F2P = "https://www.freetogame.com/api/games?sort-by=popularity";
const RAWG = "https://api.rawg.io/api/games";
const RAWG_GENRES = [["", "Tous"], ["action", "Action"], ["adventure", "Aventure"], ["role-playing-games-rpg", "RPG"], ["strategy", "Stratégie"], ["shooter", "Tir"], ["puzzle", "Réflexion"], ["racing", "Course"], ["sports", "Sport"], ["indie", "Indé"]];

export function open(root, { quit, playGame, games = [] }) {
  const ui = shell(root, { title: "Arcadia Prime", sub: "Tous les mondes du jeu", accent: "#f472b6", quit });
  const st = store("games");
  let tab = ["sol", "f2p", "rawg"].includes(st.get("tab", "sol")) ? st.get("tab", "sol") : "sol";
  let dead = false;
  const cache = {};

  ui.body.innerHTML = `
    <div class="gm-hero"><canvas id="gm-cv"></canvas></div>
    <div class="rd-tabs gm-tabs" id="gm-tabs">
      <button data-t="sol" type="button">🧑‍🚀 Soluniariens</button>
      <button data-t="f2p" type="button">🆓 Free-to-Game</button>
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
    ({ sol, f2p, rawg })[t]?.();
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

  /* ---------- 3. RAWG (clé gratuite) ---------- */
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

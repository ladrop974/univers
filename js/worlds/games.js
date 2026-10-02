// Planète JEUX « Arcadia Prime » : les jeux faits par des Soluniariens, puis le reste du monde du jeu.
// Données : catalogue d'Univers (games/index.json), Free-to-Game et GamerPower (gratuits, sans clé).
import { esc, store, getJSON, shell } from "./common.js";

const F2P = "https://www.freetogame.com/api/games?sort-by=popularity";

export function open(root, { quit, playGame, games = [] }) {
  const ui = shell(root, { title: "Arcadia Prime", sub: "Tous les mondes du jeu", accent: "#f472b6", quit });
  const st = store("games");
  let tab = ["sol", "f2p", "gift"].includes(st.get("tab", "sol")) ? st.get("tab", "sol") : "sol";
  let dead = false;
  const cache = {};

  ui.body.innerHTML = `
    <div class="gm-hero"><canvas id="gm-cv"></canvas></div>
    <div class="rd-tabs gm-tabs" id="gm-tabs">
      <button data-t="sol" type="button">🧑‍🚀 Soluniariens</button>
      <button data-t="f2p" type="button">🆓 Free-to-Game</button>
      <button data-t="gift" type="button">🎁 Jeux offerts</button>
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
    ({ sol, f2p, gift: gifts })[t]?.();
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

  /* ---------- 3. Jeux offerts (GamerPower, sans clé) ---------- */
  async function gifts() {
    let platform = "", kind = "game";
    view().innerHTML = `<h3>Jeux offerts</h3><p class="muted">Les jeux et bonus gratuits du moment (Steam, Epic, GOG, consoles, mobile). Des offres à durée limitée, mises à jour en continu.</p>
      <div class="chips" id="g-kind"></div><div class="chips" id="g-plat"></div>
      <div class="rd-status muted" id="g-status">Chargement…</div><div class="gm-grid" id="g-grid"></div>
      <p class="muted">Données <a href="https://www.gamerpower.com" target="_blank" rel="noopener noreferrer">GamerPower</a></p>`;
    $("#g-kind").innerHTML = [["game", "Jeux complets"], ["loot", "Bonus (DLC, objets)"], ["beta", "Bêtas"]]
      .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === kind ? "on" : ""}">${l}</button>`).join("");
    $("#g-plat").innerHTML = [["", "Toutes plateformes"], ["pc", "PC"], ["steam", "Steam"], ["epic-games-store", "Epic"], ["gog", "GOG"], ["ps5", "PS5"], ["xbox-series-xs", "Xbox"], ["android", "Android"], ["ios", "iOS"]]
      .map(([v, l]) => `<button type="button" data-v="${v}" class="${v === platform ? "on" : ""}">${l}</button>`).join("");
    async function go() {
      $("#g-status").textContent = "Chargement…";
      $("#g-grid").innerHTML = "";
      const p = new URLSearchParams({ type: kind, "sort-by": "popularity" });
      if (platform) p.set("platform", platform);
      try {
        const d = await getJSON(`https://www.gamerpower.com/api/giveaways?${p}`, 20000);
        if (dead || tab !== "gift") return;
        const rows = Array.isArray(d) ? d : [];
        $("#g-status").textContent = rows.length ? `${rows.length} offres en cours` : "Aucune offre pour le moment sur cette plateforme.";
        $("#g-grid").innerHTML = rows
          .map((o) => `<a class="gm-card" href="${esc(o.gamerpower_url)}" target="_blank" rel="noopener noreferrer">
            <img src="${esc(o.thumbnail)}" alt="" loading="lazy" /><b>${esc(o.title.replace(/\s*\(?giveaway\)?$/i, ""))}</b>
            <small>${esc(o.description)}</small>
            <em>${o.worth && o.worth !== "N/A" ? "Valeur " + esc(o.worth) + " · " : ""}${esc(o.platforms)}${o.end_date && o.end_date !== "N/A" ? " · jusqu'au " + esc(o.end_date.slice(0, 10)) : ""}</em></a>`)
          .join("");
      } catch {
        if (!dead && tab === "gift") $("#g-status").textContent = "Le service d'offres ne répond pas. Réessaie dans un instant.";
      }
    }
    $("#g-kind").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      kind = b.dataset.v;
      for (const x of $("#g-kind").children) x.classList.toggle("on", x.dataset.v === kind);
      go();
    };
    $("#g-plat").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      platform = b.dataset.v;
      for (const x of $("#g-plat").children) x.classList.toggle("on", x.dataset.v === platform);
      go();
    };
    go();
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

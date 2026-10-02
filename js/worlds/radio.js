// Planète RADIO « Fréquence Orion » : les radios du monde, captées comme des signaux venus de l'espace.
// Données : Radio Browser (radio-browser.info), gratuit, sans clé.
import { esc, store, getJSON, shell } from "./common.js";

const API = "https://de1.api.radio-browser.info/json";
const SECTORS = [
  ["FR", "France"], ["RE", "La Réunion"], ["US", "États-Unis"], ["GB", "Royaume-Uni"], ["DE", "Allemagne"], ["ES", "Espagne"], ["IT", "Italie"],
  ["BR", "Brésil"], ["JP", "Japon"], ["CA", "Canada"], ["MA", "Maroc"], ["SN", "Sénégal"], ["MG", "Madagascar"], ["MU", "Maurice"],
];
const FREQS = [
  ["jazz", "Jazz"], ["rock", "Rock"], ["pop", "Pop"], ["classical", "Classique"], ["electronic", "Électro"], ["hip hop", "Hip-hop"],
  ["reggae", "Reggae"], ["lofi", "Lo-fi"], ["ambient", "Ambient"], ["news", "Infos"], ["metal", "Metal"], ["world", "Monde"],
];

export function open(root, { quit }) {
  const ui = shell(root, { title: "Fréquence Orion", sub: "Capte les radios du monde", accent: "#38bdf8", quit });
  const st = store("radio");
  let beacons = st.get("beacons", []); // stations gardées
  let list = [];
  let cur = null;
  let tab = "scan"; // scan | beacons
  let query = { tag: "", cc: "", text: "" };
  let dead = false;
  const audio = new Audio();
  audio.preload = "none";

  ui.body.innerHTML = `
    <div class="rd-grid">
      <section class="rd-left">
        <div class="rd-tabs"><button data-t="scan" class="on" type="button">📡 Scanner</button><button data-t="beacons" type="button">⭐ Mes balises <i id="rd-n"></i></button></div>
        <form class="rd-search"><input id="rd-q" placeholder="Capter un signal (nom de radio)…" autocomplete="off" /><button type="submit">Scanner</button></form>
        <h3>Secteurs</h3><div class="chips" id="rd-sectors"></div>
        <h3>Fréquences</h3><div class="chips" id="rd-freqs"></div>
        <div class="rd-status muted" id="rd-status"></div>
        <ul class="rd-list" id="rd-list"></ul>
      </section>
      <section class="rd-right">
        <div class="rd-planet"><canvas id="rd-cv"></canvas></div>
        <div class="rd-now" id="rd-now"><small>Aucun signal verrouillé</small></div>
      </section>
    </div>
    <div class="rd-bar">
      <button id="rd-play" type="button" aria-label="Lecture / pause" disabled>▶</button>
      <div class="rd-bar-t" id="rd-bar-t">Choisis un signal</div>
      <label>🔊 <input id="rd-vol" type="range" min="0" max="1" step="0.05" value="${st.get("vol", 0.8)}" /></label>
    </div>`;
  const $ = (s) => ui.body.querySelector(s);
  audio.volume = st.get("vol", 0.8);

  const chipRow = (el, items, key) => {
    el.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${esc(v)}">${esc(l)}</button>`).join("");
    el.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const on = query[key] === b.dataset.v;
      query[key] = on ? "" : b.dataset.v;
      if (key !== "text") query.text = "";
      $("#rd-q").value = "";
      for (const x of el.children) x.classList.toggle("on", x.dataset.v === query[key]);
      tab = "scan";
      setTab();
      scan();
    };
  };
  chipRow($("#rd-sectors"), SECTORS, "cc");
  chipRow($("#rd-freqs"), FREQS, "tag");

  const setTab = () => {
    for (const b of ui.body.querySelectorAll(".rd-tabs button")) b.classList.toggle("on", b.dataset.t === tab);
    $("#rd-n").textContent = beacons.length ? `(${beacons.length})` : "";
  };
  ui.body.querySelector(".rd-tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    tab = b.dataset.t;
    setTab();
    if (tab === "beacons") {
      list = beacons.slice();
      $("#rd-status").textContent = list.length ? "" : "Aucune balise : appuie sur ⭐ à côté d'un signal pour le garder ici.";
      render();
    } else scan();
  };
  $(".rd-search").onsubmit = (e) => {
    e.preventDefault();
    query = { tag: "", cc: "", text: $("#rd-q").value.trim() };
    for (const x of ui.body.querySelectorAll(".chips button")) x.classList.remove("on");
    tab = "scan";
    setTab();
    scan();
  };

  async function scan() {
    const status = $("#rd-status");
    status.textContent = "Balayage des fréquences…";
    $("#rd-list").innerHTML = "";
    const p = new URLSearchParams({ limit: "60", hidebroken: "true", order: "votes", reverse: "true", is_https: "true" });
    if (query.tag) p.set("tag", query.tag);
    if (query.cc) p.set("countrycode", query.cc);
    if (query.text) p.set("name", query.text);
    if (!query.tag && !query.cc && !query.text) p.set("limit", "40");
    try {
      const rows = await getJSON(`${API}/stations/search?${p}`);
      if (dead) return;
      list = rows.filter((r) => r.url_resolved && r.url_resolved.startsWith("https://") && !r.hls).slice(0, 40);
      status.textContent = list.length ? `${list.length} signaux captés` : "Aucun signal sur cette fréquence. Essaie un autre secteur.";
    } catch {
      if (dead) return;
      list = [];
      status.textContent = "Les antennes ne répondent pas. Vérifie ta connexion puis rescanne.";
    }
    render();
  }

  const isBeacon = (id) => beacons.some((b) => b.stationuuid === id);
  function render() {
    $("#rd-list").innerHTML = list
      .map((r) => {
        const strength = Math.max(1, Math.min(5, Math.round(Math.log10((r.votes || 0) + 1) * 1.6)));
        return `<li class="${cur?.stationuuid === r.stationuuid ? "on" : ""}" data-id="${esc(r.stationuuid)}">
          <button type="button" class="rd-pick"><span class="sig" aria-label="Signal ${strength} sur 5">${"▮".repeat(strength)}${"▯".repeat(5 - strength)}</span>
            <b>${esc(r.name.trim() || "Signal inconnu")}</b>
            <small>${esc(r.country || "")}${r.tags ? " · " + esc(r.tags.split(",").slice(0, 3).join(", ")) : ""}${r.bitrate ? " · " + r.bitrate + " kb/s" : ""}</small></button>
          <button type="button" class="rd-star ${isBeacon(r.stationuuid) ? "on" : ""}" aria-label="Garder ce signal">${isBeacon(r.stationuuid) ? "★" : "☆"}</button></li>`;
      })
      .join("");
  }
  $("#rd-list").onclick = (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const r = list.find((x) => x.stationuuid === li.dataset.id);
    if (!r) return;
    if (e.target.closest(".rd-star")) {
      beacons = isBeacon(r.stationuuid) ? beacons.filter((b) => b.stationuuid !== r.stationuuid) : [...beacons, r];
      st.set("beacons", beacons.slice(0, 200));
      setTab();
      if (tab === "beacons") list = beacons.slice();
      render();
    } else tune(r);
  };

  /* ---------- lecture ---------- */
  function tune(r) {
    cur = r;
    $("#rd-now").innerHTML = `<small>Signal verrouillé</small><b>${esc(r.name.trim())}</b><span>${esc(r.country || "")}${r.codec ? " · " + esc(r.codec) : ""}${r.bitrate ? " · " + r.bitrate + " kb/s" : ""}</span>${r.homepage ? `<a href="${esc(r.homepage)}" target="_blank" rel="noopener noreferrer">Site de la radio ↗</a>` : ""}`;
    $("#rd-bar-t").textContent = "Connexion au signal…";
    audio.src = r.url_resolved;
    audio.play().catch(() => {});
    fetch(`${API}/url/${r.stationuuid}`).catch(() => {}); // compte l'écoute côté Radio Browser (usage demandé par l'API)
    render();
  }
  audio.onplaying = () => {
    $("#rd-play").textContent = "⏸";
    $("#rd-bar-t").textContent = "📡 " + (cur?.name.trim() || "");
  };
  audio.onpause = () => ($("#rd-play").textContent = "▶");
  audio.onwaiting = () => ($("#rd-bar-t").textContent = "Signal faible… " + (cur?.name.trim() || ""));
  audio.onerror = () => {
    if (!cur) return;
    $("#rd-bar-t").textContent = "Signal perdu : " + cur.name.trim();
    $("#rd-play").textContent = "▶";
    ui.toast("Ce signal ne répond pas. Essaie-en un autre.");
  };
  $("#rd-play").disabled = false;
  $("#rd-play").onclick = () => {
    if (!cur) return ui.toast("Choisis d'abord un signal dans la liste.");
    if (audio.paused) audio.play().catch(() => ui.toast("Lecture bloquée par le navigateur."));
    else audio.pause();
  };
  $("#rd-vol").oninput = (e) => {
    audio.volume = +e.target.value;
    st.set("vol", audio.volume);
  };

  /* ---------- planète animée ---------- */
  const cv = $("#rd-cv");
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
    const w = cv.width, h = cv.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.24;
    const s = t / 1000;
    const playing = !audio.paused && !audio.ended;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const k = ((s * (playing ? 0.5 : 0.18) + i / 4) % 1);
      g.strokeStyle = `rgba(56,189,248,${(1 - k) * (playing ? 0.7 : 0.3)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, R * (1.05 + k * 1.35), 0, 7);
      g.stroke();
    }
    const grd = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    grd.addColorStop(0, "#7dd3fc");
    grd.addColorStop(0.55, "#2563eb");
    grd.addColorStop(1, "#0b1a4a");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, R, 0, 7);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, 7);
    g.clip();
    g.strokeStyle = "rgba(255,255,255,.18)";
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(cx, cy + i * R * 0.25, R, R * 0.08 + Math.abs(Math.sin(s * 0.6 + i)) * R * 0.04, 0, 0, 7);
      g.stroke();
    }
    g.restore();
    // antenne au sommet
    g.strokeStyle = "#e0f2fe";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, cy - R);
    g.lineTo(cx, cy - R * 1.35);
    g.stroke();
    g.fillStyle = playing ? "#f87171" : "#94a3b8";
    g.beginPath();
    g.arc(cx, cy - R * 1.37, 5, 0, 7);
    g.fill();
    // satellites en orbite + ondes
    for (let i = 0; i < 3; i++) {
      const a = s * (0.5 + i * 0.17) + i * 2.1;
      const rx = R * (1.6 + i * 0.28), ry = rx * 0.32;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      g.strokeStyle = "rgba(148,163,184,.25)";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, 7);
      g.stroke();
      g.fillStyle = "#e2e8f0";
      g.fillRect(x - 7, y - 3, 14, 6);
      g.fillStyle = "#38bdf8";
      g.fillRect(x - 12, y - 2, 4, 4);
      g.fillRect(x + 8, y - 2, 4, 4);
    }
    if (playing) {
      g.fillStyle = "#bae6fd";
      g.font = `${Math.round(R * 0.2)}px system-ui, sans-serif`;
      for (let i = 0; i < 4; i++) {
        const k = (s * 0.35 + i / 4) % 1;
        g.globalAlpha = 1 - k;
        g.fillText(i % 2 ? "♪" : "♫", cx + Math.sin(s + i * 1.7) * R * 1.8, cy - R * 0.2 - k * R * 1.7);
      }
      g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  setTab();
  scan();
  return {
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      ui.destroy();
    },
  };
}

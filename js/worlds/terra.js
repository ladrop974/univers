// Planète MÉTÉO & TERRE « Observatoire Terra » : un globe vivant (séismes, Station spatiale, jour/nuit) et des sondes météo.
// Données : Open-Meteo (météo + villes), USGS (séismes), wheretheiss.at (ISS), Natural Earth via world-atlas (continents). Gratuit, sans clé.
import { esc, store, getJSON, shell } from "./common.js";
import { glyph } from "../glyphs.js";

const D3 = "https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm";
const TOPO = "https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm";
const LAND = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";
const QUAKES = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const ISS = "https://api.wheretheiss.at/v1/satellites/25544";

const WMO = (c) =>
  c === 0 ? ["sun", "Ciel dégagé"] : c <= 2 ? ["cloudsun", "Peu nuageux"] : c === 3 ? ["cloud", "Couvert"] : c <= 48 ? ["fog", "Brouillard"] : c <= 57 ? ["rain", "Bruine"]
  : c <= 67 ? ["rain", "Pluie"] : c <= 77 ? ["snow", "Neige"] : c <= 82 ? ["rain", "Averses"] : c <= 86 ? ["snow", "Averses de neige"] : ["storm", "Orage"];
const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

export function open(root, { quit }) {
  const ui = shell(root, { title: "Observatoire Terra", sub: "Météo, séismes et Station spatiale en direct", accent: "#34d399", quit });
  const st = store("terra");
  let place = st.get("place", { name: "Saint-Denis (La Réunion)", lat: -20.88, lon: 55.45 });
  let quakes = [];
  let iss = null;
  let trail = [];
  let dead = false;
  let layers = st.get("layers", { quakes: true, iss: true, night: true });

  ui.body.innerHTML = `
    <div class="tr-grid">
      <section class="tr-globe"><canvas id="tr-cv" aria-label="Globe terrestre"></canvas><div class="tr-hint muted" id="tr-hint">Chargement du globe…</div>
        <div class="tr-layers">
          <label><input type="checkbox" data-l="quakes" ${layers.quakes ? "checked" : ""}/> ${glyph("waves", 16)} Séismes</label>
          <label><input type="checkbox" data-l="iss" ${layers.iss ? "checked" : ""}/> ${glyph("satellite", 16)} Station</label>
          <label><input type="checkbox" data-l="night" ${layers.night ? "checked" : ""}/> ${glyph("moon", 16)} Nuit</label></div></section>
      <section class="tr-side">
        <form class="rd-search" id="tr-form"><input id="tr-q" placeholder="Déployer une sonde : ville…" autocomplete="off" /><button type="submit">Envoyer</button></form>
        <div class="tr-probe" id="tr-probe"><small class="muted">Sonde en cours de déploiement…</small></div>
        <h3>${glyph("satellite", 16)} Station spatiale</h3><div class="tr-iss muted" id="tr-iss">Recherche du signal…</div>
        <h3>${glyph("waves", 16)} Secousses des dernières 24 h</h3><ul class="tr-quakes" id="tr-quakes"></ul>
      </section>
    </div>`;
  const $ = (s) => ui.body.querySelector(s);

  /* ---------- météo : la sonde ---------- */
  async function probe(p) {
    place = p;
    st.set("place", p);
    const el = $("#tr-probe");
    el.innerHTML = `<small class="muted">Sonde sur ${esc(p.name)}…</small>`;
    try {
      const d = await getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`,
      );
      if (dead) return;
      const c = d.current;
      const [ic, label] = WMO(c.weather_code);
      el.innerHTML = `<div class="tr-now"><span class="tr-ic">${glyph(ic, 46)}</span><div><b>${esc(p.name)}</b><div class="tr-temp">${Math.round(c.temperature_2m)}°C</div><small>${label} · ressenti ${Math.round(c.apparent_temperature)}°</small></div></div>
        <div class="tr-stats"><span>${glyph("wind", 16)} ${Math.round(c.wind_speed_10m)} km/h</span><span>${glyph("droplet", 16)} ${c.relative_humidity_2m} %</span><span>${c.is_day ? glyph("sun", 16) + " Jour" : glyph("moon", 16) + " Nuit"}</span></div>
        <div class="tr-days">${d.daily.time.map((t, i) => `<div><small>${DAYS[new Date(t + "T12:00").getDay()]}</small><span>${glyph(WMO(d.daily.weather_code[i])[0], 24)}</span><b>${Math.round(d.daily.temperature_2m_max[i])}°</b><small>${Math.round(d.daily.temperature_2m_min[i])}°</small></div>`).join("")}</div>`;
    } catch {
      if (!dead) el.innerHTML = `<small class="muted">La sonde ne répond pas. Réessaie : ${esc(p.name)}.</small>`;
    }
    focus(p.lat, p.lon);
  }
  $("#tr-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = $("#tr-q").value.trim();
    if (!name) return ui.toast("Écris le nom d'une ville.");
    try {
      const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=fr`);
      const r = d.results?.[0];
      if (!r) return ui.toast("Aucune ville de ce nom sur la carte stellaire.");
      probe({ name: `${r.name}${r.country ? " (" + r.country + ")" : ""}`, lat: r.latitude, lon: r.longitude });
    } catch {
      ui.toast("Le répertoire des villes ne répond pas.");
    }
  };

  /* ---------- séismes et station ---------- */
  async function loadQuakes() {
    try {
      const d = await getJSON(QUAKES);
      if (dead) return;
      quakes = d.features.map((f) => ({ mag: f.properties.mag, place: f.properties.place, t: f.properties.time, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })).sort((a, b) => b.mag - a.mag);
      $("#tr-quakes").innerHTML = quakes.length
        ? quakes.slice(0, 12).map((q, i) => `<li><button type="button" data-i="${i}"><b>M${q.mag.toFixed(1)}</b> ${esc(q.place || "Zone inconnue")}</button></li>`).join("")
        : `<li class="muted">Rien à signaler.</li>`;
    } catch {
      if (!dead) $("#tr-quakes").innerHTML = `<li class="muted">Capteurs sismiques indisponibles.</li>`;
    }
  }
  $("#tr-quakes").onclick = (e) => {
    const b = e.target.closest("button");
    if (b) {
      const q = quakes[+b.dataset.i];
      focus(q.lat, q.lon);
    }
  };
  async function loadIss() {
    try {
      const d = await getJSON(ISS, 8000);
      if (dead) return;
      iss = { lat: d.latitude, lon: d.longitude };
      trail.push(iss);
      if (trail.length > 40) trail.shift();
      $("#tr-iss").textContent = `Altitude ${Math.round(d.altitude)} km · ${Math.round(d.velocity).toLocaleString("fr-FR")} km/h · ${d.visibility === "daylight" ? "en plein jour" : d.visibility === "eclipsed" ? "dans l'ombre de la Terre" : "au crépuscule"}`;
    } catch {
      if (!dead && !iss) $("#tr-iss").textContent = "Signal de la Station perdu pour l'instant.";
    }
  }
  const issTimer = setInterval(loadIss, 6000);

  for (const cb of ui.body.querySelectorAll(".tr-layers input"))
    cb.onchange = () => {
      layers[cb.dataset.l] = cb.checked;
      st.set("layers", layers);
    };

  /* ---------- globe ---------- */
  const cv = $("#tr-cv");
  const g = cv.getContext("2d");
  let proj, path, land, graticule, geoCircle;
  let rot = [-place.lon, -place.lat * 0.6, 0];
  let target = null;
  let dragging = false;
  let last = null;
  let start = null;
  let raf = 0;
  let idleUntil = 0;
  const fit = () => {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.max(1, cv.clientWidth * d);
    cv.height = Math.max(1, cv.clientHeight * d);
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(cv);

  function focus(lat, lon) {
    target = [-lon, -lat * 0.8, 0];
    idleUntil = performance.now() + 8000;
  }
  cv.onpointerdown = (e) => {
    dragging = true;
    last = start = [e.clientX, e.clientY];
    cv.setPointerCapture(e.pointerId);
    target = null;
  };
  cv.onpointermove = (e) => {
    if (!dragging) return;
    rot[0] += (e.clientX - last[0]) * 0.4;
    rot[1] = Math.max(-80, Math.min(80, rot[1] - (e.clientY - last[1]) * 0.4));
    last = [e.clientX, e.clientY];
    idleUntil = performance.now() + 4000;
  };
  cv.onpointerup = (e) => {
    const moved = start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 6;
    dragging = false;
    // un simple clic sur le globe déploie une sonde à cet endroit
    if (moved && proj) {
      const r = cv.getBoundingClientRect();
      const k = cv.width / r.width;
      const pt = proj.invert([(e.clientX - r.left) * k, (e.clientY - r.top) * k]);
      if (pt && Number.isFinite(pt[0])) probe({ name: `${pt[1].toFixed(1)}°, ${pt[0].toFixed(1)}°`, lat: pt[1], lon: pt[0] });
    }
  };

  function sunPoint() {
    const now = new Date();
    const day = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5;
    const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10));
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
    return [-(hours - 12) * 15, decl];
  }

  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    if (!proj) return;
    if (target) {
      rot[0] += (target[0] - rot[0]) * 0.08;
      rot[1] += (target[1] - rot[1]) * 0.08;
      if (Math.abs(target[0] - rot[0]) < 0.3 && Math.abs(target[1] - rot[1]) < 0.3) target = null;
    } else if (!dragging && t > idleUntil) rot[0] += 0.06;
    const w = cv.width, h = cv.height, R = Math.min(w, h) * 0.4;
    proj.translate([w / 2, h / 2]).scale(R).rotate(rot);
    g.clearRect(0, 0, w, h);
    // atmosphère
    const halo = g.createRadialGradient(w / 2, h / 2, R * 0.98, w / 2, h / 2, R * 1.22);
    halo.addColorStop(0, "rgba(52,211,153,.5)");
    halo.addColorStop(1, "rgba(52,211,153,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(w / 2, h / 2, R * 1.22, 0, 7);
    g.fill();
    g.beginPath();
    path({ type: "Sphere" });
    g.fillStyle = "#0b2a5b";
    g.fill();
    g.beginPath();
    path(graticule);
    g.strokeStyle = "rgba(255,255,255,.07)";
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    path(land);
    g.fillStyle = "#2f9e6b";
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.25)";
    g.stroke();
    if (layers.night) {
      const [sl, sd] = sunPoint();
      g.beginPath();
      path(geoCircle.center([sl + 180, -sd]).radius(90)());
      g.fillStyle = "rgba(2,6,23,.55)";
      g.fill();
    }
    const vis = (lon, lat) => {
      const c = proj([lon, lat]);
      if (!c) return null;
      // face cachée : distance au centre de la vue > 90°
      const [cl, cp] = [-rot[0], -rot[1]];
      const d = Math.acos(Math.sin((cp * Math.PI) / 180) * Math.sin((lat * Math.PI) / 180) + Math.cos((cp * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.cos(((lon - cl) * Math.PI) / 180));
      return d < Math.PI / 2 ? c : null;
    };
    const s = t / 1000;
    if (layers.quakes)
      for (const q of quakes) {
        const c = vis(q.lon, q.lat);
        if (!c) continue;
        const r = (2 + q.mag * 1.3) * (cv.width / 700 + 0.6);
        const k = (s * 0.8 + q.lon) % 1;
        g.strokeStyle = `rgba(248,113,113,${1 - Math.abs(k)})`;
        g.beginPath();
        g.arc(c[0], c[1], r * (1 + Math.abs(k) * 1.8), 0, 7);
        g.stroke();
        g.fillStyle = "#f87171";
        g.beginPath();
        g.arc(c[0], c[1], r, 0, 7);
        g.fill();
      }
    if (layers.iss && iss) {
      g.strokeStyle = "rgba(250,250,250,.5)";
      g.beginPath();
      let pen = false;
      for (const p of trail) {
        const c = vis(p.lon, p.lat);
        if (!c) {
          pen = false;
          continue;
        }
        pen ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1]);
        pen = true;
      }
      g.stroke();
      const c = vis(iss.lon, iss.lat);
      if (c) {
        g.fillStyle = "#fde047";
        g.fillRect(c[0] - 6, c[1] - 2, 12, 4);
        g.fillStyle = "#38bdf8";
        g.fillRect(c[0] - 10, c[1] - 4, 4, 8);
        g.fillRect(c[0] + 6, c[1] - 4, 4, 8);
      }
    }
    // la sonde
    const pc = vis(place.lon, place.lat);
    if (pc) {
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(pc[0], pc[1], 8 + Math.sin(s * 3) * 2, 0, 7);
      g.stroke();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(pc[0], pc[1], 3, 0, 7);
      g.fill();
    }
    // nuages qui dérivent autour de la planète
    g.fillStyle = "rgba(255,255,255,.12)";
    for (let i = 0; i < 5; i++) {
      const a = s * 0.12 + i * 1.3;
      const x = w / 2 + Math.cos(a) * R * 1.1, y = h / 2 + Math.sin(a * 0.9 + i) * R * 0.55;
      g.beginPath();
      g.ellipse(x, y, R * 0.13, R * 0.04, 0, 0, 7);
      g.fill();
    }
  };

  (async () => {
    try {
      const [d3, topo, atlas] = await Promise.all([import(D3), import(TOPO), getJSON(LAND, 20000)]);
      if (dead) return;
      proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
      path = d3.geoPath(proj, g);
      geoCircle = d3.geoCircle();
      graticule = d3.geoGraticule10();
      land = topo.feature(atlas, atlas.objects.land);
      $("#tr-hint").textContent = "Glisse pour tourner · touche la Terre pour y envoyer une sonde";
      raf = requestAnimationFrame(frame);
    } catch {
      $("#tr-hint").textContent = "Le globe n'a pas pu se charger (connexion). La météo et les séismes restent disponibles.";
    }
  })();

  probe(place);
  loadQuakes();
  loadIss();
  const quakeTimer = setInterval(loadQuakes, 5 * 60 * 1000);
  return {
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      clearInterval(issTimer);
      clearInterval(quakeTimer);
      ro.disconnect();
      ui.destroy();
    },
  };
}

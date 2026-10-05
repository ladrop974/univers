// « Mon système » : les planètes créées par le joueur tournent en orbite autour de la planète principale d'Univers.
import { glyphPath } from "./glyphs.js";

const TAU = Math.PI * 2;

/** Disposition pure et testable : positions initiales sur 3 anneaux elliptiques. */
export function orbitLayout(n, w, h) {
  const count = Math.max(n, 1);
  const hw = Math.max(w / 2 - 48, 40);
  const hh = Math.max(h / 2 - 48, 30);
  const rings = [0.46, 0.72, 0.96];
  const perRing = [0, 0, 0];
  for (let i = 0; i < count; i++) perRing[i % 3]++;
  const seen = [0, 0, 0];
  return Array.from({ length: count }, (_, i) => {
    const k = i % 3;
    const j = seen[k]++;
    return { ring: k, rx: hw * rings[k], ry: hh * rings[k], a0: (j * TAU) / perRing[k] + k * 1.1, speed: 0.16 / (1 + k * 0.55), r: Math.max(16, Math.min(30, Math.min(w, h) * 0.066)) };
  });
}
export const orbitPos = (o, w, h, t) => {
  const a = o.a0 + o.speed * t;
  const s = Math.sin(a);
  return { x: w / 2 + o.rx * Math.cos(a), y: h / 2 + o.ry * s, depth: s, scale: 0.88 + 0.12 * s };
};

const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#7aa2ff");

export function mountOrbit(cv, { getPlanets, onOpen, onCreate }) {
  const g = cv.getContext("2d");
  let W = 0, H = 0, D = 1, raf = 0, hover = -1, lay = [], pos = [], clock = 0, last = 0;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3, p: Math.random() * 6.28 }));
  let planets = getPlanets();

  const fit = () => {
    D = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.clientWidth;
    H = cv.clientHeight;
    cv.width = Math.max(1, W * D);
    cv.height = Math.max(1, H * D);
    lay = orbitLayout(planets.length, W, H);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(cv);
  fit();

  const hit = (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bd = 1e9;
    pos.forEach((p, i) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < p.r * 1.6 && d < bd) {
        best = i;
        bd = d;
      }
    });
    return best;
  };
  cv.onpointermove = (e) => {
    hover = hit(e);
    cv.style.cursor = hover >= 0 ? "pointer" : "default";
  };
  cv.onpointerleave = () => (hover = -1);
  cv.onclick = (e) => {
    const i = hit(e);
    if (i < 0) return;
    if (planets.length) onOpen(planets[i]);
    else onCreate();
  };
  cv.setAttribute("role", "img");
  cv.setAttribute("aria-label", planets.length ? `Système de ${planets.length} planète(s) en orbite` : "Aucune planète en orbite pour le moment");

  const ball = (x, y, R, c0, c1) => {
    const grd = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    grd.addColorStop(0, c0);
    grd.addColorStop(1, c1);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, R, 0, TAU);
    g.fill();
  };

  const frame = (ms) => {
    const dt = last ? Math.min((ms - last) / 1000, 0.1) : 0;
    last = ms;
    if (!reduce && hover < 0) clock += dt;
    const t = clock;
    g.setTransform(D, 0, 0, D, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const s of stars) {
      g.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(s.p + t * 0.7));
      g.fillStyle = "#fff";
      g.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      const o = orbitLayout(3, W, H)[k];
      g.strokeStyle = "rgba(160,180,255,.14)";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(W / 2, H / 2, o.rx, o.ry, 0, 0, TAU);
      g.stroke();
    }
    // planète principale
    const R = Math.max(26, Math.min(W, H) * 0.1);
    const glow = g.createRadialGradient(W / 2, H / 2, R * 0.6, W / 2, H / 2, R * 3);
    glow.addColorStop(0, "rgba(122,162,255,.35)");
    glow.addColorStop(1, "rgba(122,162,255,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(W / 2, H / 2, R * 3, 0, TAU);
    g.fill();
    ball(W / 2, H / 2, R, "#cfe0ff", "#3b4fb8");
    g.fillStyle = "#e9edff";
    g.textAlign = "center";
    g.font = "700 13px system-ui, sans-serif";
    g.fillText("UNIVERS", W / 2, H / 2 + R + 18);

    const list = planets.length ? planets : [{ name: "Ta planète", glyph: "plus", color: "#7aa2ff", color2: "#b388ff", ghost: true }];
    pos = lay.map((o, i) => ({ ...orbitPos(o, W, H, t), r: o.r }));
    const order = pos.map((_, i) => i).sort((a, b) => pos[a].depth - pos[b].depth);
    for (const i of order) {
      const p = pos[i], pl = list[i];
      const k = (hover === i ? 1.18 : 1) * p.scale;
      const r = p.r * k;
      g.globalAlpha = pl.ghost ? 0.55 + 0.3 * Math.sin(t * 2) : 1;
      ball(p.x, p.y, r, hex(pl.color), hex(pl.color2 || pl.color));
      const gs = r * 1.15;
      g.save();
      g.translate(p.x - gs / 2, p.y - gs / 2);
      g.scale(gs / 24, gs / 24);
      g.strokeStyle = "#fff";
      g.lineWidth = 1.9;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.stroke(glyphPath(pl.glyph));
      g.restore();
      g.font = "600 12px system-ui, sans-serif";
      g.fillStyle = "#e9edff";
      g.fillText(pl.name.length > 16 ? pl.name.slice(0, 15) + "…" : pl.name, p.x, p.y + r + 15);
      g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return {
    refresh() {
      planets = getPlanets();
      lay = orbitLayout(planets.length, W, H);
      cv.setAttribute("aria-label", planets.length ? `Système de ${planets.length} planète(s) en orbite` : "Aucune planète en orbite pour le moment");
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}

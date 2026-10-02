// Galaxie d'accueil : les grandes planètes d'Univers, animées. Chaque planète a ses propres satellites.
export const WORLDS = [
  { id: "radio", name: "Fréquence Orion", tag: "Radios du monde", emoji: "📡", color: "#38bdf8" },
  { id: "library", name: "Bibliotheca Nova", tag: "Livres et archives", emoji: "📚", color: "#a78bfa" },
  { id: "terra", name: "Observatoire Terra", tag: "Météo, séismes, Station", emoji: "🌍", color: "#34d399" },
];

export function mountGalaxy(cv, onOpen) {
  const g = cv.getContext("2d");
  let W = 0, H = 0, D = 1, raf = 0, hover = -1;
  let pos = [];
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28 }));
  const fit = () => {
    D = Math.min(devicePixelRatio || 1, 1.5);
    W = cv.clientWidth;
    H = cv.clientHeight;
    cv.width = Math.max(1, W * D);
    cv.height = Math.max(1, H * D);
    const narrow = W < 600;
    const R = narrow ? Math.min(W * 0.19, 76) : Math.min(W * 0.115, 112, H * 0.28);
    pos = narrow
      ? [[0.5, 0.16], [0.5, 0.48], [0.5, 0.78]].map(([x, y]) => ({ x: x * W, y: y * H, R }))
      : [[0.18, 0.5], [0.5, 0.44], [0.82, 0.54]].map(([x, y]) => ({ x: x * W, y: y * H, R }));
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(cv);

  const hit = (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return pos.findIndex((p) => Math.hypot(x - p.x, y - p.y) < p.R * 1.5);
  };
  cv.onpointermove = (e) => {
    hover = hit(e);
    cv.style.cursor = hover >= 0 ? "pointer" : "default";
  };
  cv.onpointerleave = () => (hover = -1);
  cv.onclick = (e) => {
    const i = hit(e);
    if (i >= 0) onOpen(WORLDS[i].id);
  };

  const ball = (x, y, R, c0, c1, c2) => {
    const grd = g.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    grd.addColorStop(0, c0);
    grd.addColorStop(0.6, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, R, 0, 7);
    g.fill();
  };

  function radio(x, y, R, s) {
    for (let i = 0; i < 4; i++) {
      const k = (s * 0.3 + i / 4) % 1;
      g.strokeStyle = `rgba(56,189,248,${(1 - k) * 0.55})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, R * (1.05 + k * 0.95), 0, 7);
      g.stroke();
    }
    ball(x, y, R, "#7dd3fc", "#2563eb", "#0b1a4a");
    g.save();
    g.beginPath();
    g.arc(x, y, R, 0, 7);
    g.clip();
    g.strokeStyle = "rgba(255,255,255,.2)";
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.ellipse(x, y + i * R * 0.3, R, R * 0.1 + Math.abs(Math.sin(s * 0.7 + i)) * R * 0.05, 0, 0, 7);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = "#e0f2fe";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y - R);
    g.lineTo(x, y - R * 1.3);
    g.stroke();
    g.fillStyle = Math.sin(s * 4) > 0 ? "#f87171" : "#7f1d1d";
    g.beginPath();
    g.arc(x, y - R * 1.33, 4, 0, 7);
    g.fill();
    for (let i = 0; i < 2; i++) {
      const a = s * (0.55 + i * 0.2) + i * 3;
      const rx = R * (1.55 + i * 0.3), ry = rx * 0.3;
      const sx = x + Math.cos(a) * rx, sy = y + Math.sin(a) * ry;
      g.strokeStyle = "rgba(148,163,184,.22)";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, 7);
      g.stroke();
      g.fillStyle = "#e2e8f0";
      g.fillRect(sx - 7, sy - 3, 14, 6);
      g.fillStyle = "#38bdf8";
      g.fillRect(sx - 12, sy - 2, 4, 4);
      g.fillRect(sx + 8, sy - 2, 4, 4);
    }
    g.fillStyle = "#bae6fd";
    g.font = `${Math.round(R * 0.22)}px system-ui, sans-serif`;
    for (let i = 0; i < 4; i++) {
      const k = (s * 0.25 + i / 4) % 1;
      g.globalAlpha = Math.sin(k * 3.14);
      g.fillText(i % 2 ? "♪" : "♫", x + R * (0.8 + (i % 3) * 0.35), y - R * 0.3 - k * R * 1.3);
    }
    g.globalAlpha = 1;
  }

  function bookAt(bx, by, sz, i, s) {
    g.save();
    g.translate(bx, by);
    g.rotate(Math.sin(s * 0.8 + i) * 0.45);
    g.fillStyle = `hsl(${(i * 47) % 360} 70% 62%)`;
    g.fillRect(-sz * 0.5, -sz * 0.7, sz, sz * 1.4);
    g.fillStyle = "rgba(255,255,255,.85)";
    g.fillRect(-sz * 0.38, -sz * 0.45, sz * 0.76, sz * 0.12);
    g.restore();
  }
  function library(x, y, R, s) {
    const n = 12;
    const rx = R * 1.7, ry = R * 0.36;
    for (let i = 0; i < n; i++) {
      const a = s * 0.32 + (i / n) * 6.283;
      if (Math.sin(a) > 0) continue;
      g.globalAlpha = 0.5;
      bookAt(x + Math.cos(a) * rx, y + Math.sin(a) * ry, R * 0.13, i, s);
    }
    g.globalAlpha = 1;
    ball(x, y, R, "#c4b5fd", "#6d28d9", "#1e1048");
    g.save();
    g.beginPath();
    g.arc(x, y, R, 0, 7);
    g.clip();
    g.strokeStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 7; i++) {
      const yy = y - R + (i + 0.5) * ((R * 2) / 7);
      g.beginPath();
      g.moveTo(x - R, yy);
      g.lineTo(x + R, yy);
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < n; i++) {
      const a = s * 0.32 + (i / n) * 6.283;
      if (Math.sin(a) <= 0) continue;
      bookAt(x + Math.cos(a) * rx, y + Math.sin(a) * ry, R * 0.17, i, s);
    }
    for (let i = 0; i < 5; i++) {
      const k = (s * 0.1 + i / 5) % 1;
      g.globalAlpha = Math.sin(k * 3.14);
      g.fillStyle = "#f5f3ff";
      g.save();
      g.translate(x + Math.sin(s * 0.7 + i * 2) * R * 1.2, y + R * 0.3 - k * R * 2);
      g.rotate(Math.sin(s + i) * 0.8);
      g.fillRect(-5, -7, 10, 14);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function terra(x, y, R, s) {
    const halo = g.createRadialGradient(x, y, R * 0.95, x, y, R * 1.3);
    halo.addColorStop(0, "rgba(52,211,153,.45)");
    halo.addColorStop(1, "rgba(52,211,153,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, R * 1.3, 0, 7);
    g.fill();
    ball(x, y, R, "#38bdf8", "#1d4ed8", "#0a1f4d");
    g.save();
    g.beginPath();
    g.arc(x, y, R, 0, 7);
    g.clip();
    g.fillStyle = "#2f9e6b";
    for (let i = 0; i < 4; i++) {
      const a = ((s * 0.1 + i * 1.57) % 6.283) - 3.14;
      const cx = x + Math.sin(a) * R * 1.1;
      g.globalAlpha = Math.max(0, Math.cos(a));
      g.beginPath();
      g.ellipse(cx, y + (i - 1.5) * R * 0.3, R * 0.32, R * 0.2, i, 0, 7);
      g.fill();
    }
    g.globalAlpha = 0.28;
    g.fillStyle = "#fff";
    for (let i = 0; i < 5; i++) {
      const a = s * 0.2 + i * 1.3;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * R * 0.9, y + (i - 2) * R * 0.3, R * 0.4, R * 0.07, 0, 0, 7);
      g.fill();
    }
    g.restore();
    g.globalAlpha = 1;
    const flash = Math.sin(s * 1.7) > 0.96 || Math.sin(s * 2.9 + 1) > 0.985;
    if (flash) {
      g.strokeStyle = "#fef08a";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + R * 0.2, y - R * 0.5);
      g.lineTo(x, y - R * 0.1);
      g.lineTo(x + R * 0.15, y - R * 0.1);
      g.lineTo(x - R * 0.05, y + R * 0.35);
      g.stroke();
    }
    g.strokeStyle = "rgba(110,231,183,.5)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, R * 1.06, -2.4 + Math.sin(s) * 0.1, -0.7, false);
    g.stroke();
    const a = s * 0.4;
    const mx = x + Math.cos(a) * R * 1.7, my = y + Math.sin(a) * R * 0.5;
    g.strokeStyle = "rgba(148,163,184,.2)";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, y, R * 1.7, R * 0.5, 0, 0, 7);
    g.stroke();
    ball(mx, my, R * 0.2, "#f1f5f9", "#94a3b8", "#475569");
    const b = -s * 0.9;
    const ix = x + Math.cos(b) * R * 1.3, iy = y + Math.sin(b) * R * 0.95;
    g.fillStyle = "#fde047";
    g.fillRect(ix - 5, iy - 2, 10, 4);
    g.fillStyle = "#38bdf8";
    g.fillRect(ix - 9, iy - 3, 3, 6);
    g.fillRect(ix + 6, iy - 3, 3, 6);
  }

  const draw = [radio, library, terra];
  const frame = (t) => {
    const s = t / 1000;
    g.setTransform(D, 0, 0, D, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const st of stars) {
      g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(st.p + s * 0.8));
      g.fillStyle = "#fff";
      g.fillRect(st.x * W, st.y * H, st.r, st.r);
    }
    g.globalAlpha = 1;
    pos.forEach((p, i) => {
      const k = hover === i ? 1.08 : 1;
      const bob = Math.sin(s * 0.6 + i * 2) * 4;
      draw[i](p.x, p.y + bob, p.R * k, s);
      g.textAlign = "center";
      g.fillStyle = "#fff";
      g.font = `700 ${W < 600 ? 15 : 17}px system-ui, sans-serif`;
      g.fillText(WORLDS[i].name, p.x, p.y + p.R * 1.95 + (W < 600 ? 0 : 6));
      g.fillStyle = WORLDS[i].color;
      g.font = `${W < 600 ? 12 : 13}px system-ui, sans-serif`;
      g.fillText(WORLDS[i].tag, p.x, p.y + p.R * 1.95 + (W < 600 ? 18 : 24));
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

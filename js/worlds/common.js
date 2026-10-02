// Outils communs aux planètes : habillage « espace », échappement, stockage local, étoiles.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const store = (slug) => ({
  get(k, d) {
    try {
      const v = localStorage.getItem(`univers.${slug}.${k}`);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`univers.${slug}.${k}`, JSON.stringify(v));
    } catch {
      /* stockage bloqué */
    }
  },
});

export async function getJSON(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Cadre commun d'une planète : fond étoilé, barre du haut avec « Retour », zone de contenu. */
export function shell(root, { title, sub, accent, quit }) {
  root.innerHTML = `<div class="world" style="--wc:${accent}">
    <canvas class="world-stars" aria-hidden="true"></canvas>
    <header class="world-top">
      <button class="world-back" type="button">← Galaxie</button>
      <div class="world-title"><b>${esc(title)}</b><small>${esc(sub)}</small></div>
    </header>
    <div class="world-body"></div>
    <div class="world-toast" role="status" aria-live="polite"></div>
  </div>`;
  root.querySelector(".world-back").onclick = quit;
  const stopStars = drawStars(root.querySelector(".world-stars"));
  const toastEl = root.querySelector(".world-toast");
  let tt;
  return {
    body: root.querySelector(".world-body"),
    toast(msg, ms = 3200) {
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      clearTimeout(tt);
      tt = setTimeout(() => toastEl.classList.remove("show"), ms);
    },
    destroy() {
      stopStars();
      clearTimeout(tt);
    },
  };
}

/** Champ d'étoiles qui scintille doucement. Renvoie la fonction d'arrêt. */
export function drawStars(cv) {
  const ctx = cv.getContext("2d");
  let stars = [];
  let raf = 0;
  const size = () => {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.max(1, cv.clientWidth * d);
    cv.height = Math.max(1, cv.clientHeight * d);
    stars = Array.from({ length: Math.round((cv.width * cv.height) / 9000) }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28, s: 0.5 + Math.random() * 1.5,
    }));
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(cv);
  const loop = (t) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + (t / 1000) * s.s));
      ctx.fillStyle = "#fff";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

// Bureau modulable : des widgets que chacun réorganise, agrandit ou masque. Les réglages restent sur son appareil.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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

const ZONES = ["Europe/Paris", "Europe/London", "America/New_York", "America/Montreal", "America/Los_Angeles", "America/Sao_Paulo", "Africa/Casablanca", "Africa/Dakar", "Asia/Dubai", "Asia/Tokyo", "Pacific/Noumea", "Pacific/Auckland", "UTC"];
const WMO = (c) =>
  c === 0 ? ["☀️", "Ciel dégagé"] : c <= 2 ? ["🌤️", "Peu nuageux"] : c === 3 ? ["☁️", "Couvert"] : c <= 48 ? ["🌫️", "Brouillard"] : c <= 57 ? ["🌦️", "Bruine"] : c <= 67 ? ["🌧️", "Pluie"] : c <= 77 ? ["❄️", "Neige"] : c <= 82 ? ["🌧️", "Averses"] : c <= 86 ? ["🌨️", "Averses de neige"] : ["⛈️", "Orage"];

export const WIDGETS = {
  clock: {
    title: "Heure", icon: "🕒", size: "m",
    mount(el, ctx) {
      const st = ctx.store;
      let tz2 = st.get("tz2", "America/New_York");
      const fmt = (tz, o) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, ...o });
      const draw = () => {
        const now = new Date();
        el.querySelector(".w-big").textContent = fmt(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);
        el.querySelector(".w-date").textContent = fmt(undefined, { weekday: "long", day: "numeric", month: "long" }).format(now);
        el.querySelector(".w-tz2").textContent = fmt(tz2, { hour: "2-digit", minute: "2-digit" }).format(now);
      };
      el.innerHTML = `<div class="w-big"></div><div class="w-date"></div>
        <div class="w-row"><select aria-label="Autre fuseau horaire">${ZONES.map((z) => `<option ${z === tz2 ? "selected" : ""}>${z}</option>`).join("")}</select><b class="w-tz2"></b></div>`;
      el.querySelector("select").onchange = (e) => {
        tz2 = e.target.value;
        st.set("tz2", tz2);
        draw();
      };
      draw();
      const t = setInterval(draw, 1000);
      return () => clearInterval(t);
    },
  },
  weather: {
    title: "Météo", icon: "⛅", size: "s",
    mount(el, ctx) {
      const st = ctx.store;
      let alive = true;
      const load = async (city) => {
        const out = el.querySelector(".w-out");
        out.textContent = "…";
        try {
          const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`)).json();
          const p = g.results?.[0];
          if (!p) throw new Error("ville introuvable");
          const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`)).json();
          if (!alive) return;
          const [ico, txt] = WMO(w.current.weather_code);
          out.innerHTML = `<span class="w-ico">${ico}</span><b>${Math.round(w.current.temperature_2m)}°C</b><small>${txt} · vent ${Math.round(w.current.wind_speed_10m)} km/h<br>${esc(p.name)}${p.country ? ", " + esc(p.country) : ""}</small>`;
        } catch (e) {
          if (alive) out.textContent = "Météo indisponible : " + (e.message || "erreur");
        }
      };
      el.innerHTML = `<form class="w-row"><input value="${esc(st.get("city", "Paris"))}" aria-label="Ville" maxlength="60" /><button>OK</button></form><div class="w-out"></div>`;
      el.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        const c = el.querySelector("input").value.trim();
        if (c) {
          st.set("city", c);
          load(c);
        }
      };
      load(st.get("city", "Paris"));
      const t = setInterval(() => load(st.get("city", "Paris")), 600000);
      return () => {
        alive = false;
        clearInterval(t);
      };
    },
  },
  favorites: {
    title: "Favoris", icon: "⭐", size: "s",
    mount(el, ctx) {
      const favs = ctx.store.get("favs", []).map((id) => ctx.S.items.find((i) => i.id === id)).filter(Boolean);
      el.innerHTML = favs.length
        ? `<ul class="w-list">${favs.map((i) => `<li><button data-id="${esc(i.id)}">${esc(ctx.icon(i))} ${esc(i.label)}</button></li>`).join("")}</ul>`
        : `<p class="w-muted">Touche ⭐ sur un élément pour l'ajouter ici.</p>`;
      el.onclick = (e) => {
        const b = e.target.closest("button[data-id]");
        if (b) ctx.open(b.dataset.id);
      };
    },
  },
  games: {
    title: "Jeux", icon: "🎮", size: "s",
    mount(el, ctx) {
      el.innerHTML = `<ul class="w-list">${ctx.games.map((g) => `<li><a href="index.html?game=${encodeURIComponent(g.id)}">${esc(g.emoji || "🎮")} ${esc(g.name)}</a></li>`).join("")}</ul>`;
    },
  },
  guestbook: {
    title: "Livre d'or", icon: "📖", size: "m",
    mount(el, ctx) {
      const { S } = ctx;
      const can = S.mode === "owner" || S.key_ok;
      const posts = S.posts || [];
      el.innerHTML = `${
        can
          ? `<form class="w-gb"><input name="a" maxlength="30" placeholder="Ton nom" value="${esc(ctx.pseudo())}" /><input name="b" maxlength="280" placeholder="Laisse un petit mot…" /><button>Envoyer</button></form>`
          : `<p class="w-muted">Entre la clé de la galaxie pour lire et écrire dans le livre d'or.</p>`
      }<ul class="w-posts">${posts
        .map(
          (p) => `<li><b>${esc(p.author)}</b> <small>${new Date(p.at).toLocaleDateString("fr-FR")}</small><br>${esc(p.body)}${S.mode === "owner" ? ` <button class="w-del" data-id="${esc(p.id)}" aria-label="Effacer">✕</button>` : ""}</li>`,
        )
        .join("") || (can ? '<li class="w-muted">Aucun message pour l\'instant.</li>' : "")}</ul>`;
      el.querySelector("form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        ctx.post(String(f.get("a")), String(f.get("b")));
      });
      el.onclick = (e) => {
        const b = e.target.closest(".w-del");
        if (b) ctx.deletePost(b.dataset.id);
      };
    },
  },
  notes: {
    title: "Bloc-notes", icon: "🗒️", size: "m",
    mount(el, ctx) {
      el.innerHTML = `<textarea maxlength="4000" placeholder="Tes idées, ta liste… (reste sur cet appareil)" aria-label="Bloc-notes"></textarea>`;
      const ta = el.querySelector("textarea");
      ta.value = ctx.store.get("notes", "");
      let t;
      ta.oninput = () => {
        clearTimeout(t);
        t = setTimeout(() => ctx.store.set("notes", ta.value), 400);
      };
    },
  },
  countdown: {
    title: "Compte à rebours", icon: "⏳", size: "s",
    mount(el, ctx) {
      const st = ctx.store;
      const cd = st.get("cd", { label: "Soirée jeux", at: "" });
      el.innerHTML = `<input class="cd-label" value="${esc(cd.label)}" maxlength="40" aria-label="Nom" /><input class="cd-at" type="datetime-local" value="${esc(cd.at)}" aria-label="Date" /><div class="w-big cd-out"></div>`;
      const out = el.querySelector(".cd-out");
      const draw = () => {
        const at = el.querySelector(".cd-at").value;
        if (!at) return (out.textContent = "Choisis une date");
        const ms = new Date(at).getTime() - Date.now();
        if (ms <= 0) return (out.textContent = "C'est l'heure ! 🎉");
        const d = Math.floor(ms / 864e5);
        const h = Math.floor((ms % 864e5) / 36e5);
        const m = Math.floor((ms % 36e5) / 6e4);
        out.textContent = `${d} j ${h} h ${m} min`;
      };
      const save = () => {
        st.set("cd", { label: el.querySelector(".cd-label").value, at: el.querySelector(".cd-at").value });
        draw();
      };
      el.querySelector(".cd-label").onchange = save;
      el.querySelector(".cd-at").onchange = save;
      draw();
      const t = setInterval(draw, 30000);
      return () => clearInterval(t);
    },
  },
  stats: {
    title: "En chiffres", icon: "📊", size: "s",
    mount(el, ctx) {
      const it = ctx.S.items;
      const n = (k) => it.filter((i) => i.kind === k).length;
      const bytes = it.reduce((a, i) => a + (i.size || 0), 0);
      const vis = (v) => it.filter((i) => i.visibility === v).length;
      el.innerHTML = `<ul class="w-list"><li>📁 ${n("folder")} dossiers</li><li>📄 ${n("file")} fichiers · ${(bytes / 1048576).toFixed(1)} Mo</li><li>🔗 ${n("link")} liens · 📝 ${n("note")} notes · 🎮 ${n("game")} jeux</li>${
        ctx.S.mode === "owner" ? `<li>🔒 ${vis("private")} privés · 🔑 ${vis("key")} avec clé · 🌍 ${vis("public")} publics</li>` : ""
      }</ul>`;
    },
  },
};

export const DEFAULT_LAYOUT = ["clock", "weather", "favorites", "games", "guestbook", "countdown", "notes", "stats"].map((id) => ({ id, size: WIDGETS[id].size, hidden: false }));

/** Monte le bureau. Renvoie une fonction de nettoyage. */
export function mountDesk(root, ctx) {
  const st = ctx.store;
  let layout = st.get("layout", null) || DEFAULT_LAYOUT.map((w) => ({ ...w }));
  // complète avec les widgets ajoutés plus tard
  for (const id of Object.keys(WIDGETS)) if (!layout.some((w) => w.id === id)) layout.push({ id, size: WIDGETS[id].size, hidden: true });
  layout = layout.filter((w) => WIDGETS[w.id]);
  let edit = false;
  let cleanups = [];

  const save = () => st.set("layout", layout);
  const draw = () => {
    cleanups.forEach((f) => f?.());
    cleanups = [];
    const hidden = layout.filter((w) => w.hidden);
    root.innerHTML = `<div class="desk-bar"><h2>Mon bureau</h2><button class="chip" data-a="edit">${edit ? "✔ Terminé" : "🎛 Personnaliser"}</button></div>
      <div class="desk${edit ? " editing" : ""}">${layout
        .filter((w) => !w.hidden)
        .map(
          (w, i) => `<section class="widget sz-${w.size}" data-id="${w.id}"><header><span>${WIDGETS[w.id].icon} ${WIDGETS[w.id].title}</span>${
            edit
              ? `<span class="w-tools"><button data-a="up" data-i="${i}" aria-label="Monter">▲</button><button data-a="down" data-i="${i}" aria-label="Descendre">▼</button><button data-a="size" data-id="${w.id}" aria-label="Taille">${w.size.toUpperCase()}</button><button data-a="hide" data-id="${w.id}" aria-label="Masquer">✕</button></span>`
              : ""
          }</header><div class="w-body"></div></section>`,
        )
        .join("")}</div>
      ${edit && hidden.length ? `<div class="desk-add"><b>Ajouter :</b> ${hidden.map((w) => `<button class="chip" data-a="show" data-id="${w.id}">${WIDGETS[w.id].icon} ${WIDGETS[w.id].title}</button>`).join(" ")}</div>` : ""}`;
    for (const w of layout.filter((x) => !x.hidden)) {
      const body = root.querySelector(`.widget[data-id="${w.id}"] .w-body`);
      cleanups.push(WIDGETS[w.id].mount(body, ctx));
    }
  };
  root.onclick = (e) => {
    const b = e.target.closest("button[data-a]");
    if (!b) return;
    const a = b.dataset.a;
    const visible = layout.filter((w) => !w.hidden);
    if (a === "edit") edit = !edit;
    else if (a === "hide") layout.find((w) => w.id === b.dataset.id).hidden = true;
    else if (a === "show") layout.find((w) => w.id === b.dataset.id).hidden = false;
    else if (a === "size") {
      const w = layout.find((x) => x.id === b.dataset.id);
      w.size = { s: "m", m: "l", l: "s" }[w.size];
    } else if (a === "up" || a === "down") {
      const i = Number(b.dataset.i);
      const j = a === "up" ? i - 1 : i + 1;
      if (j >= 0 && j < visible.length) {
        const A = layout.indexOf(visible[i]);
        const B = layout.indexOf(visible[j]);
        [layout[A], layout[B]] = [layout[B], layout[A]];
      }
    } else return;
    save();
    draw();
  };
  draw();
  return () => cleanups.forEach((f) => f?.());
}

// Planète BIBLIOTHÈQUE « Bibliotheca Nova » : les livres du monde rangés comme des archives stellaires.
// Données : Open Library (catalogue, couvertures) et Internet Archive (lecture des livres libres). Gratuit, sans clé.
import { esc, store, getJSON, shell } from "./common.js";
import { glyph } from "../glyphs.js";

const OL = "https://openlibrary.org";
const FIELDS = "key,title,author_name,cover_i,first_publish_year,ia,ebook_access,subject,number_of_pages_median";
const NEBULAS = [
  ["science_fiction", "Science-fiction"], ["fantasy", "Fantasy"], ["mystery_and_detective_stories", "Polar"], ["romance", "Romance"],
  ["history", "Histoire"], ["philosophy", "Philosophie"], ["poetry", "Poésie"], ["astronomy", "Astronomie"], ["comics", "BD"],
  ["cooking", "Cuisine"], ["children", "Jeunesse"], ["computer_science", "Informatique"],
];

export function open(root, { quit }) {
  const ui = shell(root, { title: "Bibliotheca Nova", sub: "Archives stellaires : des millions de livres", accent: "#a78bfa", quit });
  const st = store("library");
  let shelf = st.get("shelf", []); // livres gardés dans « ma soute »
  let books = [];
  let tab = "scan";
  let q = { text: "", subject: "", free: false, fr: false };
  let dead = false;
  let seq = 0;

  ui.body.innerHTML = `
    <div class="lb-hero"><canvas id="lb-cv"></canvas></div>
    <div class="lb-main">
      <div class="rd-tabs"><button data-t="scan" class="on" type="button">${glyph("telescope", 16)} Explorer</button><button data-t="shelf" type="button">${glyph("folder", 16)} Ma soute <i id="lb-n"></i></button></div>
      <form class="rd-search" id="lb-form"><input id="lb-q" placeholder="Titre, auteur, sujet…" autocomplete="off" /><button type="submit">Chercher</button></form>
      <div class="chips" id="lb-neb"></div>
      <div class="lb-opts"><label><input type="checkbox" id="lb-free" /> ${glyph("radio", 16)} Lisibles en ligne seulement</label><label><input type="checkbox" id="lb-fr" /> En français</label></div>
      <div class="rd-status muted" id="lb-status"></div>
      <div class="lb-grid" id="lb-grid"></div>
      <button class="lb-more" id="lb-more" type="button" hidden>Charger la suite</button>
    </div>
    <div class="lb-modal" id="lb-modal" hidden></div>`;
  const $ = (s) => ui.body.querySelector(s);
  let page = 1;

  $("#lb-neb").innerHTML = NEBULAS.map(([v, l]) => `<button type="button" data-v="${esc(v)}">${esc(l)}</button>`).join("");
  $("#lb-neb").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    q.subject = q.subject === b.dataset.v ? "" : b.dataset.v;
    q.text = "";
    $("#lb-q").value = "";
    for (const x of $("#lb-neb").children) x.classList.toggle("on", x.dataset.v === q.subject);
    goScan();
  };
  $("#lb-form").onsubmit = (e) => {
    e.preventDefault();
    q.text = $("#lb-q").value.trim();
    q.subject = "";
    for (const x of $("#lb-neb").children) x.classList.remove("on");
    goScan();
  };
  $("#lb-free").onchange = (e) => {
    q.free = e.target.checked;
    goScan();
  };
  $("#lb-fr").onchange = (e) => {
    q.fr = e.target.checked;
    goScan();
  };
  const setTab = () => {
    for (const b of ui.body.querySelectorAll(".rd-tabs button")) b.classList.toggle("on", b.dataset.t === tab);
    $("#lb-n").textContent = shelf.length ? `(${shelf.length})` : "";
    $("#lb-more").hidden = tab !== "scan" || !books.length;
  };
  ui.body.querySelector(".rd-tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    tab = b.dataset.t;
    if (tab === "shelf") {
      books = shelf.slice();
      $("#lb-status").textContent = books.length ? "" : "Ta soute est vide : appuie sur « Garder » dans la fiche d'un livre.";
      render();
    } else goScan();
    setTab();
  };

  function goScan() {
    tab = "scan";
    page = 1;
    books = [];
    setTab();
    scan(false);
  }

  async function scan(append) {
    const my = ++seq;
    const status = $("#lb-status");
    status.textContent = append ? "Chargement…" : "Exploration des archives…";
    if (!append) $("#lb-grid").innerHTML = "";
    const p = new URLSearchParams({ fields: FIELDS, limit: "24", page: String(page) });
    let qs = q.text || (q.subject ? `subject:"${q.subject.replace(/_/g, " ")}"` : "subject:\"science fiction\"");
    if (q.free) p.set("has_fulltext", "true");
    if (q.free) qs += " ebook_access:public";
    if (q.fr) p.set("language", "fre");
    p.set("q", qs);
    try {
      const d = await getJSON(`${OL}/search.json?${p}`, 20000);
      if (dead || my !== seq) return;
      const rows = (d.docs || []).filter((b) => b.title);
      books = append ? books.concat(rows) : rows;
      status.textContent = books.length ? `${d.numFound.toLocaleString("fr-FR")} ouvrages dans cette zone` : "Rien dans cette zone. Essaie un autre mot.";
      $("#lb-more").hidden = !rows.length || books.length >= d.numFound;
    } catch {
      if (dead || my !== seq) return;
      status.textContent = "Les archives ne répondent pas. Réessaie dans un instant.";
    }
    render();
  }
  $("#lb-more").onclick = () => {
    page++;
    scan(true);
  };

  const onShelf = (key) => shelf.some((b) => b.key === key);
  const cover = (b, s = "M") => (b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-${s}.jpg` : "");
  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  function render() {
    $("#lb-grid").innerHTML = books
      .map((b, i) => {
        const img = cover(b);
        const free = b.ebook_access === "public" && b.ia?.length;
        return `<button type="button" class="lb-card" data-i="${i}">
          <span class="lb-cover" style="--h:${hue(b.title)}">${img ? `<img src="${img}" alt="" loading="lazy" onerror="this.remove()" />` : ""}<em>${esc(b.title)}</em>${free ? '<u title="Lisible en ligne">${glyph("radio", 14)}</u>' : ""}</span>
          <b>${esc(b.title)}</b><small>${esc((b.author_name || ["Auteur inconnu"])[0])}${b.first_publish_year ? " · " + b.first_publish_year : ""}</small></button>`;
      })
      .join("");
  }
  $("#lb-grid").onclick = (e) => {
    const c = e.target.closest(".lb-card");
    if (c) openBook(books[+c.dataset.i]);
  };

  /* ---------- fiche d'un livre ---------- */
  async function openBook(b) {
    const m = $("#lb-modal");
    const free = b.ebook_access === "public" && b.ia?.length;
    const ia = free ? b.ia.find((x) => !x.startsWith("isbn_")) || b.ia[0] : "";
    m.hidden = false;
    m.innerHTML = `<div class="lb-sheet" role="dialog" aria-label="${esc(b.title)}">
      <button class="lb-x" type="button" aria-label="Fermer">${glyph("close", 18)}</button>
      <div class="lb-sheet-top">${cover(b, "L") ? `<img src="${cover(b, "L")}" alt="" onerror="this.remove()" />` : ""}
        <div><h2>${esc(b.title)}</h2><p class="muted">${esc((b.author_name || []).join(", ") || "Auteur inconnu")}${b.first_publish_year ? " · " + b.first_publish_year : ""}${b.number_of_pages_median ? " · " + b.number_of_pages_median + " p." : ""}</p>
        <p class="lb-desc muted">Lecture de la fiche…</p>
        <div class="row"><button type="button" id="lb-keep">${onShelf(b.key) ? "Dans ma soute" : "Garder dans ma soute"}</button>
        ${free ? `<button type="button" id="lb-read">${glyph("book", 16)} Lire maintenant</button>` : ""}
        <a class="lb-link" href="${OL}${esc(b.key)}" target="_blank" rel="noopener noreferrer">Fiche Open Library ↗</a></div></div></div>
      <div class="lb-reader" id="lb-reader" hidden></div></div>`;
    const close = () => {
      m.hidden = true;
      m.innerHTML = "";
    };
    m.querySelector(".lb-x").onclick = close;
    m.onclick = (e) => {
      if (e.target === m) close();
    };
    m.querySelector("#lb-keep").onclick = (e) => {
      shelf = onShelf(b.key) ? shelf.filter((x) => x.key !== b.key) : [...shelf, b];
      st.set("shelf", shelf.slice(0, 300));
      e.target.textContent = onShelf(b.key) ? "Dans ma soute" : "Garder dans ma soute";
      setTab();
    };
    const rd = m.querySelector("#lb-read");
    if (rd)
      rd.onclick = () => {
        const r = m.querySelector("#lb-reader");
        r.hidden = false;
        r.innerHTML = `<iframe title="Lecteur" src="https://archive.org/embed/${encodeURIComponent(ia)}" allowfullscreen loading="lazy"></iframe>
          <p class="muted">Si le lecteur reste vide : <a href="https://archive.org/details/${encodeURIComponent(ia)}" target="_blank" rel="noopener noreferrer">ouvrir sur Internet Archive ↗</a></p>`;
        r.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
    try {
      const d = await getJSON(`${OL}${b.key}.json`);
      if (dead || m.hidden) return;
      let t = typeof d.description === "string" ? d.description : d.description?.value || "";
      t = t.replace(/\r?\n---[\s\S]*$/, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
      m.querySelector(".lb-desc").textContent = t ? (t.length > 700 ? t.slice(0, 700) + "…" : t) : "Pas de résumé dans les archives.";
    } catch {
      const el = m.querySelector(".lb-desc");
      if (el) el.textContent = "Résumé indisponible pour l'instant.";
    }
  }

  /* ---------- planète animée : livres en orbite ---------- */
  const cv = $("#lb-cv");
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
    const w = cv.width, h = cv.height, cx = w * 0.5, cy = h * 0.62, R = Math.min(w * 0.18, h * 0.5);
    const s = t / 1000;
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
    grd.addColorStop(0, "#c4b5fd");
    grd.addColorStop(0.6, "#6d28d9");
    grd.addColorStop(1, "#1e1048");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, R, 0, 7);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, 7);
    g.clip();
    g.strokeStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 7; i++) {
      const y = cy - R + (i + 0.5) * ((R * 2) / 7);
      g.beginPath();
      g.moveTo(cx - R, y);
      g.lineTo(cx + R, y);
      g.stroke();
    }
    g.restore();
    // anneau de livres en orbite
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = s * 0.35 + (i / n) * 6.283;
      const rx = R * 1.75, ry = R * 0.42;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      const front = Math.sin(a) > 0;
      if (!front) continue; // ceux de derrière sont dessinés avant la planète ci-dessous
      book(g, x, y, R * 0.16, i, s);
    }
    for (let i = 0; i < n; i++) {
      const a = s * 0.35 + (i / n) * 6.283;
      if (Math.sin(a) > 0) continue;
      const x = cx + Math.cos(a) * R * 1.75, y = cy + Math.sin(a) * R * 0.42;
      g.globalAlpha = 0.55;
      book(g, x, y, R * 0.13, i, s);
      g.globalAlpha = 1;
    }
    // pages qui s'envolent
    for (let i = 0; i < 6; i++) {
      const k = (s * 0.12 + i / 6) % 1;
      g.globalAlpha = Math.sin(k * 3.14);
      g.fillStyle = "#f5f3ff";
      const x = cx + Math.sin(s * 0.7 + i * 2) * R * 1.3, y = cy + R * 0.2 - k * R * 2.4;
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(s + i) * 0.8);
      g.fillRect(-5, -7, 10, 14);
      g.restore();
    }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  function book(g, x, y, sz, i, s) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(s * 0.8 + i) * 0.4);
    g.fillStyle = `hsl(${(i * 47) % 360} 70% 62%)`;
    g.fillRect(-sz * 0.5, -sz * 0.7, sz, sz * 1.4);
    g.fillStyle = "rgba(255,255,255,.85)";
    g.fillRect(-sz * 0.38, -sz * 0.45, sz * 0.76, sz * 0.12);
    g.restore();
  }
  raf = requestAnimationFrame(frame);

  setTab();
  goScan();
  return {
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      ui.destroy();
    },
  };
}

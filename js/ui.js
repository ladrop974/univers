// Composants d'interface communs : icônes SVG, fenêtres de dialogue, notifications, cadre de page, étiquettes d'état.
import { esc, drawStars } from "./worlds/common.js";
import { STATUS } from "./modules.js";
import { FX } from "./design.js";
import { glyph } from "./glyphs.js";

export { glyph };

const P = {
  back: '<path d="M15 18l-6-6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/>',
  play: '<path d="M7 5l12 7-12 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', ext: '<path d="M14 4h6v6M10 14L20 4M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>', orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', check: '<path d="M5 12l5 5 9-10"/>',
  right: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', drive: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>', tool: '<path d="M14 7a4 4 0 1 0 3 3l4 4-3 3-4-4a4 4 0 0 1 0-6z"/>',
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 5.3M20 4v7h-7"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
export const icon = (name, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

export const statusBadge = (st) => `<span class="sp-badge ${esc(st)}" title="${esc(STATUS[st]?.hint || "")}">${esc(STATUS[st]?.label || st)}</span>`;

/* ---------- notifications ---------- */
let toasts;
export function toast(msg, ms = 3400) {
  if (!toasts) {
    toasts = document.createElement("div");
    toasts.className = "sp-toasts";
    toasts.setAttribute("role", "status");
    toasts.setAttribute("aria-live", "polite");
    document.body.appendChild(toasts);
  }
  const t = document.createElement("div");
  t.className = "sp-toast";
  t.textContent = msg;
  toasts.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- fenêtres ---------- */
/**
 * Ouvre une fenêtre. `body` : HTML. `actions` : [{ label, value, primary, danger, keepOpen }].
 * `onMount(el, close)` permet de brancher des comportements. Résout avec la valeur choisie (null si fermée).
 */
export function dialog({ title, body = "", actions = [{ label: "Fermer", value: true, primary: true }], dismissible = true, wide = false, accent, onMount }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const ov = document.createElement("div");
    ov.className = "sp-modal";
    if (accent) ov.style.setProperty("--wc", accent);
    ov.innerHTML = `<div class="sp-dialog ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="sp-body">${body}</div>
      <div class="sp-foot">${actions.map((a, i) => `<button type="button" class="sp-btn ${a.primary ? "primary" : ""} ${a.danger ? "danger" : ""}" data-i="${i}">${esc(a.label)}</button>`).join("")}</div></div>`;
    document.body.appendChild(ov);
    const close = (v = null) => {
      document.removeEventListener("keydown", onKey);
      ov.remove();
      prev?.focus?.();
      resolve(v);
    };
    const onKey = (e) => e.key === "Escape" && dismissible && close(null);
    document.addEventListener("keydown", onKey);
    ov.onclick = (e) => {
      if (e.target === ov && dismissible) close(null);
      const b = e.target.closest("[data-i]");
      if (!b) return;
      const a = actions[b.dataset.i];
      if (a.keepOpen) a.onClick?.(ov, close);
      else close(a.value);
    };
    onMount?.(ov.querySelector(".sp-body"), close);
    (ov.querySelector("input,textarea") || ov.querySelector(".sp-btn.primary") || ov.querySelector("button"))?.focus();
  });
}
export const confirmDialog = (message, { ok = "Confirmer", title = "Confirmation", danger = false } = {}) =>
  dialog({ title, body: `<p class="sp-muted" style="font-size:1rem">${esc(message)}</p>`, actions: [{ label: "Annuler", value: false }, { label: ok, value: true, primary: !danger, danger }] }).then((v) => v === true);
export function promptDialog({ title, label, value = "", max = 30, ok = "Valider" }) {
  let field;
  return dialog({
    title,
    body: `<label class="sp-field"><span>${esc(label)}</span><input class="sp-input" maxlength="${max}" value="${esc(value)}" /></label>`,
    actions: [{ label: "Annuler", value: null }, { label: ok, primary: true, keepOpen: true, onClick: (_ov, close) => close(field.value.trim() || null) }],
    onMount: (el, close) => {
      field = el.querySelector("input");
      field.onkeydown = (e) => e.key === "Enter" && close(field.value.trim() || null);
    },
  });
}

/* ---------- cadre de page ---------- */
/** Page plein écran « station » : fond étoilé, décor animé facultatif, barre du haut avec retour. */
export function page(root, { title, sub, color = "#7aa2ff", color2, fx = "aucun", quit, back = "Galaxie", actions = "", glyph: gid = "" }) {
  const gls = FX[fx]?.glyphs || [];
  const fxHtml = gls.length
    ? `<div class="sp-fx" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<span style="left:${(i * 37 + 7) % 100}%;animation-delay:${-(i * 1.7) % 20}s;animation-duration:${16 + (i % 5) * 3}s;color:var(--wc)">${glyph(gls[i % gls.length], 18 + (i % 4) * 7)}</span>`).join("")}</div>`
    : "";
  root.innerHTML = `<div class="sp-root" style="--wc:${esc(color)};--wc2:${esc(color2 || color)}"><canvas class="sp-stars" aria-hidden="true"></canvas>${fxHtml}
    <header class="sp-top"><button type="button" class="sp-btn sm" data-q>${icon("back", 16)}${esc(back)}</button>
      <div class="sp-title"><b>${gid ? glyph(gid, 18) + " " : ""}${esc(title)}</b><small>${esc(sub || "")}</small></div><div class="sp-row" data-actions>${actions}</div></header>
    <div class="sp-body-wrap"></div></div>`;
  root.querySelector("[data-q]").onclick = quit;
  const stop = drawStars(root.querySelector(".sp-stars"));
  return { body: root.querySelector(".sp-body-wrap"), top: root.querySelector("[data-actions]"), destroy: stop };
}

// Fenêtre « guide rapide » adaptée à l'âge, en pas à pas.
import { dialog, icon } from "./ui.js";
import { esc } from "./worlds/common.js";
import { quickGuide } from "./guide.js";

export function showGuide(band, planetName, accent) {
  const g = quickGuide(band, planetName);
  let i = 0;
  let view;
  const paint = () => {
    const s = g.steps[i];
    view.innerHTML = `<div class="sp-steps">${g.steps.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
      <p class="sp-eyebrow">Étape ${i + 1} sur ${g.steps.length}</p><h3 style="margin:0 0 8px;font-size:1.15rem">${esc(s.h)}</h3>
      <p style="margin:0;font-size:${band <= 5 ? "1.15rem" : "1rem"};line-height:1.55;color:var(--sp-dim)">${esc(s.p)}</p>`;
  };
  return dialog({
    title: g.title,
    accent,
    body: '<div data-view></div>',
    actions: [
      { label: "Passer", value: "skip" },
      { label: "Précédent", keepOpen: true, onClick: () => { i = Math.max(0, i - 1); paint(); } },
      { label: "Suivant", primary: true, keepOpen: true, onClick: (ov, close) => { if (i >= g.steps.length - 1) return close("done"); i++; paint(); ov.querySelector(".sp-btn.primary").textContent = i >= g.steps.length - 1 ? "Terminer" : "Suivant"; } },
    ],
    onMount: (el) => {
      view = el.querySelector("[data-view]");
      paint();
    },
  });
}
export const guideButton = (label = "Guide") => `<button type="button" class="sp-btn sm" data-guide aria-label="${esc(label)}">${icon("book", 16)}<span class="lbl">${esc(label)}</span></button>`;

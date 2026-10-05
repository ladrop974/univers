// Design d'une planète : palettes, décors animés, noms et slogans par thème.
// « Laisser l'IA faire » = générateur de design intégré : gratuit, hors ligne, aucune clé. Logique pure (testée).
export const FX = {
  aucun: { label: "Aucun", glyphs: [] },
  etoiles: { label: "Étoiles", glyphs: ["sparkles", "star", "moon"] },
  notes: { label: "Notes", glyphs: ["music", "disc", "piano"] },
  feuilles: { label: "Feuilles", glyphs: ["leaf", "flower", "bird"] },
  bulles: { label: "Bulles", glyphs: ["droplet", "waves", "sparkles"] },
  fusees: { label: "Fusées", glyphs: ["rocket", "satellite", "moon"] },
  livres: { label: "Livres", glyphs: ["book", "library", "wand"] },
  pinceaux: { label: "Peinture", glyphs: ["palette", "brush", "sparkles"] },
  gourmand: { label: "Gourmand", glyphs: ["cherry", "chef", "utensils"] },
  idees: { label: "Idées", glyphs: ["bulb", "help", "brain"] },
  monde: { label: "Voyage", glyphs: ["globe", "compass", "plane"] },
  jeux: { label: "Jeux", glyphs: ["dices", "gamepad", "trophy"] },
};
export const FX_IDS = Object.keys(FX);

export const PALETTES = [
  ["#f472b6", "#7c3aed"], ["#34d399", "#0ea5e9"], ["#38bdf8", "#6366f1"], ["#fbbf24", "#f97316"], ["#a78bfa", "#ec4899"],
  ["#22d3ee", "#10b981"], ["#fb923c", "#ef4444"], ["#facc15", "#84cc16"],
];

export const DESIGNS = {
  musique: { fx: "notes", glyphs: ["music", "headphones", "piano", "disc"], palettes: [0, 4, 2], names: ["Mélodia", "Rythmia", "Harmonia", "Note Nova", "Planète Refrain"], tags: ["Là où chaque note voyage", "Écoute, joue, rêve", "La planète qui chante"] },
  nature: { fx: "feuilles", glyphs: ["paw", "flower", "leaf", "bird"], palettes: [1, 5, 7], names: ["Sauvagia", "Verdalia", "Faunia", "Planète Jungle", "Écolia"], tags: ["Des animaux et des plantes à découvrir", "La vie, partout", "Explore le vivant"] },
  espace: { fx: "fusees", glyphs: ["rocket", "telescope", "planet", "moon"], palettes: [2, 4, 5], names: ["Cosmia", "Astéria", "Orbitia", "Planète Fusée", "Galaxia"], tags: ["Cap sur les étoiles", "L'espace n'a pas de limite", "Décollage immédiat"] },
  livres: { fx: "livres", glyphs: ["library", "book", "wand", "crown"], palettes: [4, 3, 0], names: ["Pagina", "Fabulia", "Contalia", "Planète Histoires", "Lectoria"], tags: ["Une histoire t'attend", "Tourne la page", "Le pays des livres"] },
  art: { fx: "pinceaux", glyphs: ["palette", "image", "brush", "sparkles"], palettes: [3, 4, 6], names: ["Coloria", "Pigmentia", "Muséa", "Planète Palette", "Artéa"], tags: ["Toutes les couleurs du monde", "Regarde, imagine, crée", "Un musée dans ta poche"] },
  cuisine: { fx: "gourmand", glyphs: ["chef", "utensils", "cherry", "heart"], palettes: [6, 3, 7], names: ["Gourmandia", "Saveuria", "Marmitia", "Planète Gâteau", "Mijotia"], tags: ["Des recettes du monde entier", "À table !", "Un voyage qui se mange"] },
  quiz: { fx: "idees", glyphs: ["brain", "bulb", "help", "trophy"], palettes: [7, 3, 4], names: ["Quizia", "Malinia", "Savantia", "Planète Questions", "Cerveau Nova"], tags: ["Teste ta tête !", "Qui saura répondre ?", "Apprends en jouant"] },
  monde: { fx: "monde", glyphs: ["globe", "compass", "plane", "map"], palettes: [5, 2, 1], names: ["Globia", "Voyagia", "Terra Nova", "Planète Boussole", "Mondia"], tags: ["Le tour du monde sans bouger", "Chaque pays a son histoire", "Cap sur l'aventure"] },
  jeux: { fx: "jeux", glyphs: ["gamepad", "dices", "trophy", "swords"], palettes: [4, 0, 6], names: ["Arcadia", "Joueria", "Pixelia", "Planète Manette", "Gamia"], tags: ["Prêt à jouer ?", "Niveau suivant !", "Les jeux n'attendent que toi"] },
};

const pick = (a, rng) => a[Math.floor(rng() * a.length)];

/** Propose un design cohérent avec le thème. Même thème, résultat différent à chaque appel. */
export function autoDesign(themeId, rng = Math.random) {
  const d = DESIGNS[themeId] || DESIGNS.espace;
  const [color, color2] = PALETTES[pick(d.palettes, rng)];
  return { name: pick(d.names, rng), glyph: pick(d.glyphs, rng), color, color2, fx: d.fx, tag: pick(d.tags, rng) };
}

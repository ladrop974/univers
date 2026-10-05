// Catalogue des modules qu'une planète peut contenir. Chaque module dit clairement son état :
//   live  = Fonctionnel (données réelles)      demo = Démo (données d'exemple)      setup = À configurer
import { CONNECTORS, THEMES } from "./catalog.js";
import * as google from "./google.js";

export const STATUS = {
  live: { label: "Fonctionnel", hint: "Données réelles, utilisable maintenant." },
  demo: { label: "Démo", hint: "Données d'exemple : rien de réel tant que tu ne connectes pas ton compte." },
  setup: { label: "À configurer", hint: "Demande une étape de réglage avant de fonctionner." },
};
export const GROUPS = [
  { id: "api", label: "Outils ouverts", sub: "API officielles, gratuites, sans clé (ou clé facultative)" },
  { id: "made", label: "Créés par des Soluniariens", sub: "Ce que la communauté a déjà construit, prêt à brancher" },
  { id: "google", label: "Messagerie et fichiers", sub: "Tes propres comptes, en lecture seule, protégés (adultes)" },
];

const live = () => "live";
const apiModules = CONNECTORS.map((c) => ({
  id: `api:${c.id}`, group: "api", kind: "api", conn: c.id, name: c.name, glyph: c.glyph, about: c.about, minAge: c.minAge, status: live, by: "API officielle",
}));

const made = [
  { id: "world:terra", worldId: "terra", name: "Observatoire Terra", glyph: "globe", about: "Météo, séismes en direct, Station spatiale et globe jour/nuit.", minAge: 5 },
  { id: "world:radio", worldId: "radio", name: "Fréquence Orion", glyph: "radio", about: "Les radios du monde. Contenu non filtré : dès 13 ans.", minAge: 13 },
  { id: "world:library", worldId: "library", name: "Bibliotheca Nova", glyph: "library", about: "Livres et archives (Open Library, Internet Archive). Recherche non filtrée : dès 13 ans.", minAge: 13 },
  { id: "world:games", worldId: "games", name: "Arcadia Prime", glyph: "gamepad", about: "Le monde du jeu : Soluniariens, jeux gratuits, jeux offerts. Dès 13 ans.", minAge: 13 },
].map((m) => ({ ...m, group: "made", kind: "world", status: live, by: "Créé par un Soluniarien" }));

const games = [
  { id: "game:morpion", gameId: "morpion", name: "Morpion", glyph: "grid", about: "Le classique, en duel.", minAge: 5 },
  { id: "game:nexus", gameId: "nexus", name: "NEXUS : Lignée Zénith", glyph: "dna", about: "Roguelite évolutif en 3D, solo, à deux ou en duel par lien.", minAge: 9 },
  { id: "game:poules", gameId: "poules", name: "Poules Armageddon", glyph: "egg", about: "Duel d'artillerie en 3D : 3 poules contre 3 poules.", minAge: 9 },
  { id: "game:spore", gameId: "spore", name: "SPORE : Fractale Vivante", glyph: "flask", about: "Fais évoluer ton organisme, seul ou en meute de 1 à 5.", minAge: 9 },
].map((m) => ({ ...m, group: "made", kind: "game", status: live, by: "Créé par un Soluniarien" }));

const SOLUNIA = "https://solunia-network.lovable.app";
const links = [
  { id: "link:solunia", name: "SolunIA Network", glyph: "satellite", about: "Galaxies sociales, dossiers, salons de jeu avec vocal, chat. S'ouvre dans l'application SolunIA.", minAge: 13 },
  { id: "link:otaku", name: "Télé et anime OTAKU", glyph: "tv", about: "Télévision en direct, anime et manga. Dans SolunIA Network : ouvre ta galaxie puis la planète OTAKU. Contenu non filtré : dès 13 ans.", minAge: 13 },
].map((m) => ({ ...m, group: "made", kind: "link", url: SOLUNIA, status: live, by: "Créé par un Soluniarien" }));

const mine = [
  { id: "google:mail", gkind: "mail", name: "Ma messagerie (Gmail)", glyph: "mail", about: "Combien de mails non lus, qui t'a écrit, depuis ton Gmail. Lecture seule : jamais le contenu des messages." },
  { id: "google:drive", gkind: "drive", name: "Mes fichiers (Google Drive)", glyph: "cloud", about: "Retrouve un fichier par son nom. Lecture seule : jamais le contenu." },
].map((m) => ({ ...m, group: "google", kind: "google", minAge: 18, status: () => (google.isConnected(m.gkind) ? "live" : "demo"), by: "Ton compte Google" }));

export const MODULES = [...apiModules, ...made, ...games, ...links, ...mine];
const STATIC_IDS = new Set(MODULES.map((m) => m.id));
export const byModuleId = (id) => MODULES.find((m) => m.id === id) || null;
/** Ids connus, y compris les jeux ajoutés plus tard au catalogue (`game:<id>`). */
export const isKnownModule = (id) => STATIC_IDS.has(id) || /^game:[a-z0-9_-]{1,30}$/.test(String(id));

/** Module pour un jeu ajouté au catalogue sans entrée dédiée. */
export const gameFallback = (g) => ({ id: `game:${g.id}`, gameId: g.id, group: "made", kind: "game", name: g.name, glyph: g.glyph || "gamepad", about: g.tagline || "", minAge: 9, status: live, by: "Créé par un Soluniarien" });
export const resolve = (id) => byModuleId(id);

/** Modules proposés pour un thème et un âge, groupés. `recommended` = coché d'office à la création. */
export function suggestions(themeId, band) {
  const theme = THEMES.find((t) => t.id === themeId);
  const rec = new Set((theme?.conns || []).map((c) => `api:${c}`));
  if (themeId === "espace" || themeId === "nature" || themeId === "monde") rec.add("world:terra");
  if (themeId === "jeux") ["game:morpion", "game:nexus", "game:poules", "world:games"].forEach((i) => rec.add(i));
  if (themeId === "quiz") rec.add("game:morpion");
  return GROUPS.map((g) => ({
    ...g,
    items: MODULES.filter((m) => m.group === g.id).map((m) => ({ module: m, allowed: m.minAge <= band, recommended: rec.has(m.id) && m.minAge <= band })),
  }));
}

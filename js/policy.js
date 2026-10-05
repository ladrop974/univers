// Règles d'âge et de sécurité des planètes. Logique pure (aucun accès au DOM) : testée par tests/policy.test.mjs.
import { FX_IDS, DESIGNS } from "./design.js";
import { isGlyph } from "./glyphs.js";
import { sanitizeTree, encodeTree, decodeTree } from "./planetmodel.js";

export const BANDS = [
  { id: 5, label: "5-8 ans", short: "5-8" },
  { id: 9, label: "9-12 ans", short: "9-12" },
  { id: 13, label: "13-17 ans", short: "13-17" },
  { id: 18, label: "Adulte", short: "18+" },
];

/** Tranche d'âge valide, sinon la plus protectrice. */
export const bandOf = (v) => {
  const n = Number(v);
  return BANDS.some((b) => b.id === n) ? n : 5;
};
export const bandLabel = (id) => BANDS.find((b) => b.id === bandOf(id)).label;
/** Une planète s'adapte toujours au plus jeune : celui qui l'a prévue ou celui qui la regarde. */
export const effectiveBand = (planetBand, viewerBand) => Math.min(bandOf(planetBand), bandOf(viewerBand));

const SEVERE = [
  "porn", "porno", "pornographie", "pornographique", "sex", "sexe", "sexes", "sexy", "sexuel", "sexuelle", "sexual",
  "erotic", "erotique", "nude", "nudes", "nu", "nue", "nus", "nues", "naked", "nsfw", "hentai", "fetish", "fetiche",
  "gore", "rape", "viol",
];
const SENSITIVE = [
  "suicide", "suicidal", "meurtre", "murder", "torture", "drogue", "drogues", "drug", "drugs", "cocaine", "heroine",
  "cannabis", "weed", "alcool", "alcohol",
];
const SEVERE_SET = new Set(SEVERE);
const ALL_SET = new Set([...SEVERE, ...SENSITIVE]);
const STRONG_SUBSTR = ["porn", "hentai", "nsfw", "xxx", "onlyfans", "xvideos"];
const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c]);

/** Vrai si le texte n'est pas adapté à cette tranche d'âge (liste volontairement prudente, jamais parfaite). */
export function isBlocked(text, band) {
  const b = bandOf(band);
  if (b >= 18) return false;
  const n = norm(text);
  const set = b < 13 ? ALL_SET : SEVERE_SET;
  if (n.split(/[^a-z]+/).some((t) => set.has(t))) return true;
  const compact = n.replace(/[^a-z]+/g, "");
  return STRONG_SUBSTR.some((w) => compact.includes(w));
}

/** Nettoie et valide une recherche libre. */
export function cleanQuery(q, band) {
  const s = String(q ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (s.length < 2) return { ok: false, reason: "Écris au moins 2 lettres." };
  if (bandOf(band) < 18 && /https?:|www\./i.test(s)) return { ok: false, reason: "Les liens ne sont pas permis ici." };
  if (isBlocked(s, band)) return { ok: false, reason: "Cette recherche n'est pas adaptée à ton âge. Essaie un autre mot !" };
  return { ok: true, q: s };
}

/** Seuls les liens https sont gardés (jamais javascript:, data:, http:). */
export function safeUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === "https:" ? x.href : "";
  } catch {
    return "";
  }
}

/** Remet un résultat d'API (donnée non fiable) sous une forme sûre ; null s'il doit être écarté. */
export function sanitizeItem(raw, source, band) {
  if (!raw || typeof raw !== "object") return null;
  const str = (v, n) => String(v ?? "").slice(0, n);
  let item;
  if (raw.kind === "quiz") {
    const answers = (Array.isArray(raw.answers) ? raw.answers : []).slice(0, 6).map((a) => str(a, 120));
    const correct = str(raw.correct, 120);
    if (!raw.q || answers.length < 2 || !answers.includes(correct)) return null;
    item = { kind: "quiz", q: str(raw.q, 300), answers, correct, title: str(raw.q, 300), sub: "", source };
  } else {
    const title = str(raw.title, 140).trim();
    if (!title) return null;
    item = {
      kind: "card", title, sub: str(raw.sub, 220), img: safeUrl(raw.img), audio: safeUrl(raw.audio), url: safeUrl(raw.url),
      glyph: isGlyph(raw.glyph) ? raw.glyph : "", credit: str(raw.credit, 120), license: str(raw.license, 60), source,
    };
  }
  if (isBlocked(`${item.title} ${item.sub} ${item.credit || ""}`, band)) return null;
  return item;
}

const rid = () => Math.random().toString(36).slice(2, 10);

/**
 * Valide une planète (créée ici, relue du stockage ou reçue par lien). Les clés d'API n'en font jamais partie.
 * `known` : fonction (id de module) -> booléen, ou liste d'ids. Un ancien format `conns` (liste d'outils) est converti.
 */
export function sanitizePlanet(o, known, themeIds) {
  if (!o || typeof o !== "object") return null;
  const isKnown = typeof known === "function" ? known : (id) => known.includes(id) || known.includes(String(id).replace(/^api:/, ""));
  const name = String(o.name ?? "").replace(/[<>]/g, "").trim().slice(0, 24);
  if (name.length < 2 || isBlocked(name, 5)) return null;
  const legacy = Array.isArray(o.conns) ? [...new Set(o.conns.map((id) => (String(id).startsWith("api:") ? String(id) : `api:${id}`)))].map((mod) => ({ type: "module", mod })) : [];
  const tree = sanitizeTree(Array.isArray(o.tree) ? o.tree : legacy, (id) => isKnown(id) || (String(id).startsWith("api:") && isKnown(String(id).slice(4))));
  const color = /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : "#38bdf8";
  const theme = themeIds.includes(o.theme) ? o.theme : themeIds[0];
  const tag = String(o.tag ?? "").replace(/[<>]/g, "").trim().slice(0, 60);
  return {
    id: typeof o.id === "string" && /^[a-z0-9]{4,20}$/.test(o.id) ? o.id : rid(),
    name,
    glyph: isGlyph(o.glyph) ? o.glyph : DESIGNS[theme]?.glyphs[0] || "planet",
    color,
    color2: /^#[0-9a-f]{6}$/i.test(o.color2) ? o.color2 : color,
    fx: FX_IDS.includes(o.fx) ? o.fx : DESIGNS[theme]?.fx || "etoiles",
    tag: isBlocked(tag, 5) ? "" : tag,
    theme,
    band: bandOf(o.band),
    tree,
  };
}

const b64 = {
  enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))),
};

/** Code de partage d'une planète (sans clé, sans identifiant). */
export const encodePlanet = (p) => b64.enc(JSON.stringify({ n: p.name, e: p.glyph, c: p.color, d: p.color2, f: p.fx, g: p.tag, t: p.theme, b: p.band, x: encodeTree(p.tree || []) }));

/** Lit un code de partage ; renvoie une planète valide ou null. */
export function decodePlanet(code, knownConnIds, themeIds) {
  try {
    const raw = String(code ?? "").trim();
    if (!raw || raw.length > 6000) return null;
    const o = JSON.parse(b64.dec(raw));
    return sanitizePlanet({ name: o.n, glyph: o.e, color: o.c, color2: o.d, fx: o.f, tag: o.g, theme: o.t, band: o.b, tree: decodeTree(o.x) }, knownConnIds, themeIds);
  } catch {
    return null;
  }
}

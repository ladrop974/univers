// Génère js/glyphs.js : les icônes de la plateforme (aucun emoji nulle part), tirées de Lucide (licence ISC)
// pour rester dans le même style que SolunIA Network. Chaque icône est UN tracé SVG (valable en <svg> et en Path2D sur canvas).
// Usage : node tools/gen_glyphs.mjs [dossier lucide-react/dist/esm/icons]
import { readFileSync, writeFileSync } from "node:fs";

const DIR = process.argv[2] || "C:/Users/marvi/dev/solunia-main/node_modules/lucide-react/dist/esm/icons";
const MAP = {
  planet: "orbit", globe: "globe", music: "music", leaf: "leaf", rocket: "rocket", book: "book-open", palette: "palette", chef: "chef-hat",
  gamepad: "gamepad-2", compass: "compass", mail: "mail", cloud: "cloud", headphones: "headphones", piano: "piano", disc: "disc-3", radio: "radio",
  paw: "paw-print", flower: "flower-2", telescope: "telescope", sun: "sun", cloudsun: "cloud-sun", rain: "cloud-rain", snow: "snowflake",
  storm: "cloud-lightning", fog: "cloud-fog", library: "library", image: "image", brain: "brain", tv: "tv", satellite: "satellite", dna: "dna",
  egg: "egg", flask: "flask-conical", grid: "grid-3x3", dices: "dices", sparkles: "sparkles", star: "star", bulb: "lightbulb", help: "circle-help",
  brush: "brush", cherry: "cherry", droplet: "droplet", bird: "bird", mountain: "mountain", map: "map", plane: "plane", shield: "shield-check",
  folder: "folder", users: "users", link: "link", search: "search", lock: "lock", trophy: "trophy", utensils: "utensils", wand: "wand-sparkles",
  moon: "moon", copy: "copy", share: "share-2", send: "send", hourglass: "hourglass", check: "circle-check", file: "file-text", clip: "paperclip",
  chat: "message-circle", key: "key-round", volume: "volume-2", pause: "pause", play: "play", close: "x", heart: "heart", wind: "wind",
  plus: "plus", waves: "waves", clock: "clock", fish: "fish", rabbit: "rabbit", crown: "crown", swords: "swords", ghost: "ghost",
};

const n = (v) => Number(v);
const num = (x) => String(+x.toFixed(3));
function toPath(tag, a) {
  switch (tag) {
    case "path":
      return a.d;
    case "circle": {
      const [cx, cy, r] = [n(a.cx), n(a.cy), n(a.r)];
      return `M${num(cx - r)} ${num(cy)}a${r} ${r} 0 1 0 ${num(2 * r)} 0a${r} ${r} 0 1 0 ${num(-2 * r)} 0`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = [n(a.cx), n(a.cy), n(a.rx), n(a.ry)];
      return `M${num(cx - rx)} ${num(cy)}a${rx} ${ry} 0 1 0 ${num(2 * rx)} 0a${rx} ${ry} 0 1 0 ${num(-2 * rx)} 0`;
    }
    case "rect": {
      const [x, y, w, h] = [n(a.x ?? 0), n(a.y ?? 0), n(a.width), n(a.height)];
      const r = Math.min(n(a.rx ?? a.ry ?? 0), w / 2, h / 2);
      return r
        ? `M${num(x + r)} ${num(y)}h${num(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${num(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${num(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${num(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}z`
        : `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`;
    }
    case "line":
      return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
    case "polyline":
    case "polygon": {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? d + "z" : d;
    }
    default:
      throw new Error("élément SVG non géré : " + tag);
  }
}

const out = {};
for (const [id, name] of Object.entries(MAP)) {
  let src = readFileSync(`${DIR}/${name}.js`, "utf8");
  for (let hop = 0; hop < 3 && !/const __iconNode/.test(src); hop++) {
    const alias = src.match(/from ['"]\.\/([\w-]+)\.js['"]/);
    if (!alias) break;
    src = readFileSync(`${DIR}/${alias[1]}.js`, "utf8");
  }
  const m = src.match(/const __iconNode = (\[[\s\S]*?\]);\s*\nconst /);
  if (!m) throw new Error("format inattendu : " + name);
  const nodes = new Function(`return ${m[1]}`)();
  out[id] = nodes.map(([tag, attrs]) => toPath(tag, attrs)).join("");
}

const body = Object.entries(out).map(([k, d]) => `  ${k}: ${JSON.stringify(d)},`).join("\n");
writeFileSync(
  new URL("../js/glyphs.js", import.meta.url),
  `// Fichier généré par tools/gen_glyphs.mjs à partir de Lucide (licence ISC, © Lucide Contributors). Ne pas modifier à la main.
// Chaque icône : un tracé SVG sur une grille 24x24, à dessiner en trait (stroke), jamais en remplissage.
export const GLYPHS = {
${body}
};
export const GLYPH_IDS = Object.keys(GLYPHS);
export const isGlyph = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(GLYPHS, id);

/** Icône SVG en ligne (hérite de la couleur du texte). */
export const glyph = (id, size = 20, cls = "") =>
  \`<svg class="gl \${cls}" width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="\${GLYPHS[id] || GLYPHS.planet}"/></svg>\`;

const cache = {};
/** Path2D prêt pour un canvas (trait à régler par l'appelant). */
export const glyphPath = (id) => (cache[id] ??= new Path2D(GLYPHS[id] || GLYPHS.planet));
`,
);
console.log("js/glyphs.js :", Object.keys(out).length, "icônes");

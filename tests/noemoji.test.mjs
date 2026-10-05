import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { GLYPHS, isGlyph, glyph } from "../js/glyphs.js";
import { CONNECTORS, THEMES } from "../js/catalog.js";
import { MODULES } from "../js/modules.js";
import { DESIGNS, FX } from "../js/design.js";

// Règle de la plateforme : jamais d'emojis dans l'interface, seulement les icônes de glyphs.js (style Lucide, comme SolunIA).
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
const ALLOWED = /[♪♫★☆▲▼◀▶]/gu; // ♪ ♫ ★ ☆ ▲ ▼ ◀ ▶ : symboles typographiques, pas des emojis

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const list = (dir) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith(".js")).map((f) => dir + f);
// Hors périmètre (non chargés par l'interface) : js/widgets.js, js/galaxy3d.js ; et les HUD internes des moteurs 3D NEXUS / SPORE.
const FILES = [
  ...list("js/").filter((f) => !/widgets|galaxy3d|glyphs/.test(f)),
  ...list("js/worlds/"),
  "index.html", "games/index.json", "games/morpion/game.js", "games/poules/game.js",
];

test("aucun emoji dans l'interface de la plateforme", () => {
  const bad = [];
  for (const f of FILES) {
    read(f).split("\n").forEach((line, i) => {
      if (EMOJI.test(line.replace(ALLOWED, ""))) bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(bad, [], "emojis à remplacer par un glyph :\n" + bad.join("\n"));
});

test("tous les glyphes référencés existent", () => {
  const ids = new Set();
  for (const c of CONNECTORS) ids.add(c.glyph);
  for (const t of THEMES) ids.add(t.glyph);
  for (const m of MODULES) ids.add(m.glyph);
  for (const d of Object.values(DESIGNS)) d.glyphs.forEach((g) => ids.add(g));
  for (const f of Object.values(FX)) f.glyphs.forEach((g) => ids.add(g));
  for (const g of JSON.parse(read("games/index.json"))) ids.add(g.glyph);
  for (const id of ids) assert.ok(isGlyph(id), `glyph inconnu : ${id}`);
});

test("les icônes sont de vrais tracés SVG, rendus en trait", () => {
  assert.ok(Object.keys(GLYPHS).length >= 70);
  for (const [id, d] of Object.entries(GLYPHS)) assert.match(d, /^[Mm]/, id);
  const svg = glyph("music", 20);
  assert.match(svg, /<svg[^>]+stroke="currentColor"/);
  assert.ok(!EMOJI.test(svg));
  assert.match(glyph("inexistant", 12), /<path d="/, "icône par défaut si inconnue");
  assert.ok(!isGlyph("toString") && !isGlyph("__proto__"));
});

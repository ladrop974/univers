import test from "node:test";
import assert from "node:assert/strict";
import { bandOf, effectiveBand, isBlocked, cleanQuery, safeUrl, sanitizeItem, sanitizePlanet, encodePlanet, decodePlanet } from "../js/policy.js";
import { CONNECTOR_IDS, THEME_IDS } from "../js/catalog.js";
import { modulesOf } from "../js/planetmodel.js";

test("tranche d'âge invalide = la plus protectrice", () => {
  assert.equal(bandOf("abc"), 5);
  assert.equal(bandOf(undefined), 5);
  assert.equal(bandOf(13), 13);
});
test("une planète s'adapte au plus jeune", () => {
  assert.equal(effectiveBand(18, 5), 5);
  assert.equal(effectiveBand(5, 18), 5);
  assert.equal(effectiveBand(13, 9), 9);
});
test("filtre de mots : sévérité selon l'âge", () => {
  assert.equal(isBlocked("porn", 13), true);
  assert.equal(isBlocked("p0rn", 5), true);
  assert.equal(isBlocked("s e x", 5), false); // limite connue : lettres espacées
  assert.equal(isBlocked("sexe", 9), true);
  assert.equal(isBlocked("drogue", 9), true);
  assert.equal(isBlocked("drogue", 13), false);
  assert.equal(isBlocked("porn", 18), false);
  assert.equal(isBlocked("seaweed lion volcan", 5), false);
  assert.equal(isBlocked("Érotique", 9), true);
});
test("recherche : nettoyage et refus", () => {
  assert.equal(cleanQuery("a", 9).ok, false);
  assert.equal(cleanQuery("  lion   roi ", 9).q, "lion roi");
  assert.equal(cleanQuery("https://x.y", 9).ok, false);
  assert.equal(cleanQuery("<script>", 9).q, "script");
  assert.equal(cleanQuery("lion ".repeat(60), 9).q.length, 60);
  assert.equal(cleanQuery("nude", 13).ok, false);
});
test("seuls les liens https passent", () => {
  assert.equal(safeUrl("https://a.org/x"), "https://a.org/x");
  assert.equal(safeUrl("http://a.org"), "");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,x"), "");
});
test("résultat d'API : assaini et filtré", () => {
  const ok = sanitizeItem({ title: "Lion", sub: "félin", img: "http://x/y.png", url: "https://x.org" }, "Test", 5);
  assert.equal(ok.img, "");
  assert.equal(ok.url, "https://x.org/");
  assert.equal(sanitizeItem({ title: "Photo nude" }, "Test", 9), null);
  assert.ok(sanitizeItem({ title: "Photo nude" }, "Test", 18));
  assert.equal(sanitizeItem({ title: "" }, "Test", 9), null);
  assert.equal(sanitizeItem({ kind: "quiz", q: "?", answers: ["a", "b"], correct: "z" }, "Test", 9), null);
  assert.ok(sanitizeItem({ kind: "quiz", q: "?", answers: ["a", "b"], correct: "a" }, "Test", 9));
});
test("planète : validation, partage sans clé", () => {
  const p = sanitizePlanet({ name: "Ma <b>planète", glyph: "music", color: "#ff00aa", theme: "musique", band: 9, conns: ["itunes", "nimporte", "itunes"], key: "SECRET" }, CONNECTOR_IDS, THEME_IDS);
  assert.deepEqual(modulesOf(p.tree), ["api:itunes"]);
  assert.equal(p.name, "Ma bplanète");
  assert.equal(p.key, undefined);
  assert.equal(sanitizePlanet({ name: "x", conns: ["itunes"] }, CONNECTOR_IDS, THEME_IDS), null);
  assert.equal(sanitizePlanet({ name: "Planète sexe", conns: ["itunes"] }, CONNECTOR_IDS, THEME_IDS), null);
  assert.deepEqual(sanitizePlanet({ name: "Ok", conns: ["zzz"] }, CONNECTOR_IDS, THEME_IDS).tree, []);
  assert.equal(sanitizePlanet({ name: "Ok", color: "red", conns: ["itunes"] }, CONNECTOR_IDS, THEME_IDS).color, "#38bdf8");
  const back = decodePlanet(encodePlanet(p), CONNECTOR_IDS, THEME_IDS);
  assert.equal(back.name, p.name);
  assert.deepEqual(modulesOf(back.tree), modulesOf(p.tree));
  assert.equal(back.band, 9);
  assert.ok(!encodePlanet(p).includes("SECRET"));
  assert.equal(decodePlanet("%%%", CONNECTOR_IDS, THEME_IDS), null);
  assert.equal(decodePlanet("a".repeat(3000), CONNECTOR_IDS, THEME_IDS), null);
});

import { autoDesign, DESIGNS, FX_IDS, PALETTES } from "../js/design.js";
import { THEMES } from "../js/catalog.js";
test("design automatique : cohérent avec chaque thème et sûr", () => {
  for (const t of THEMES) {
    assert.ok(DESIGNS[t.id], t.id + " sans design");
    assert.ok(FX_IDS.includes(DESIGNS[t.id].fx));
    for (let i = 0; i < 20; i++) {
      const d = autoDesign(t.id);
      assert.match(d.color, /^#[0-9a-f]{6}$/i);
      assert.match(d.color2, /^#[0-9a-f]{6}$/i);
      assert.equal(d.fx, DESIGNS[t.id].fx);
      assert.equal(isBlocked(`${d.name} ${d.tag}`, 5), false);
      const p = sanitizePlanet({ ...d, theme: t.id, band: 5, conns: [t.conns[0]] }, CONNECTOR_IDS, THEME_IDS);
      assert.ok(p, t.id + " : design refusé par la validation");
    }
  }
  assert.ok(PALETTES.length >= 6);
});
test("personnalisation : valeurs invalides remplacées, partage fidèle", () => {
  const p = sanitizePlanet({ name: "Ma planète", theme: "musique", color: "#aa00bb", color2: "pas-une-couleur", fx: "inconnu", tag: "<i>Salut</i>", band: 9, conns: ["itunes"] }, CONNECTOR_IDS, THEME_IDS);
  assert.equal(p.color2, "#aa00bb");
  assert.equal(p.fx, "notes");
  assert.equal(p.tag, "iSalut/i");
  const q = decodePlanet(encodePlanet({ ...p, color2: "#112233", fx: "bulles" }), CONNECTOR_IDS, THEME_IDS);
  assert.equal(q.color2, "#112233");
  assert.equal(q.fx, "bulles");
});

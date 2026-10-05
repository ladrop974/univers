import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTORS, THEMES, byId, run } from "../js/catalog.js";
import { BANDS } from "../js/policy.js";

const ages = BANDS.map((b) => b.id);

test("chaque connecteur est complet et légal", () => {
  const ids = new Set();
  for (const c of CONNECTORS) {
    assert.ok(!ids.has(c.id), "id en double " + c.id);
    ids.add(c.id);
    assert.ok(c.name && c.glyph && c.about && c.license && c.attribution && c.limits, c.id + " : champs manquants");
    assert.ok(ages.includes(c.minAge), c.id + " : minAge invalide");
    assert.ok(c.searchMinAge >= c.minAge, c.id + " : searchMinAge < minAge");
    assert.equal(typeof c.discover, "function", c.id + " : discover manquant (sinon planète vide pour les petits)");
    if (c.searchMinAge <= 18) assert.equal(typeof c.search, "function", c.id + " : search manquant");
    for (const u of [c.official, c.terms]) assert.ok(u.startsWith("https://"), c.id + " : lien officiel non https");
    assert.ok(Array.isArray(c.guide) && c.guide.length >= 3, c.id + " : guide trop court");
    if (c.key) assert.ok(c.key.id && c.key.label && c.key.signup.startsWith("https://"), c.id + " : clé mal décrite");
  }
});
test("thèmes cohérents", () => {
  for (const t of THEMES) {
    assert.ok(t.conns.length >= 1);
    for (const id of t.conns) assert.ok(byId(id), t.id + " -> " + id + " inconnu");
    assert.equal(t.minAge, Math.min(...t.conns.map((id) => byId(id).minAge)));
    assert.match(t.color, /^#[0-9a-f]{6}$/i);
  }
});
test("les 5-8 ans ont de quoi explorer dans presque tous les thèmes", () => {
  const ok = THEMES.filter((t) => t.minAge <= 5).length;
  assert.ok(ok >= 7, "seulement " + ok + " thèmes pour les 5-8 ans");
});
test("run() refuse un connecteur trop mature, sans appeler le réseau", async () => {
  let called = false;
  const fake = { id: "f", name: "F", minAge: 13, searchMinAge: 13, search: async () => { called = true; return []; }, discover: async () => { called = true; return []; } };
  assert.deepEqual(await run(fake, "discover", "", { band: 9 }), []);
  assert.deepEqual(await run(fake, "search", "chat", { band: 9 }), []);
  assert.equal(called, false);
});
test("run() filtre les résultats et refuse les recherches interdites", async () => {
  const fake = { id: "f", name: "F", minAge: 5, searchMinAge: 5, search: async () => [{ title: "Lion" }, { title: "nude" }, { title: "Chat", img: "http://x" }], discover: async () => [] };
  const r = await run(fake, "search", "animal", { band: 5 });
  assert.deepEqual(r.map((i) => i.title), ["Lion", "Chat"]);
  assert.equal(r[1].img, "");
  await assert.rejects(() => run(fake, "search", "porn", { band: 5 }), /pas adaptée/);
});

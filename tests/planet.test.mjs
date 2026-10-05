import test from "node:test";
import assert from "node:assert/strict";
import { makeFolder, makeModule, addNode, removeNode, renameNode, find, count, modulesOf, sanitizeTree, encodeTree, decodeTree, MAX_NODES, MAX_DEPTH } from "../js/planetmodel.js";
import { sanitizePlanet, encodePlanet, decodePlanet, BANDS } from "../js/policy.js";
import { MODULES, GROUPS, STATUS, isKnownModule, suggestions, byModuleId } from "../js/modules.js";
import { THEMES, THEME_IDS } from "../js/catalog.js";
import { parse, cityOf, driveTerm } from "../js/assistant.js";
import { quickGuide } from "../js/guide.js";

test("arbre : sous-dossiers, ajout, renommage, suppression", () => {
  let t = [];
  const f = makeFolder("Ma musique");
  t = addNode(t, null, f);
  const sub = makeFolder("Rock");
  t = addNode(t, f.id, sub);
  t = addNode(t, sub.id, makeModule("api:itunes"));
  assert.equal(count(t), 3);
  assert.equal(find(t, sub.id).depth, 2);
  assert.deepEqual(modulesOf(t), ["api:itunes"]);
  t = renameNode(t, sub.id, "Rock <b>lourd");
  assert.equal(find(t, sub.id).node.name, "Rock blourd");
  t = removeNode(t, f.id);
  assert.equal(count(t), 0);
});

test("arbre : profondeur et taille limitées", () => {
  let t = [];
  let parent = null;
  for (let i = 0; i < MAX_DEPTH; i++) {
    const f = makeFolder("n" + i);
    t = addNode(t, parent, f);
    parent = f.id;
  }
  assert.equal(addNode(t, parent, makeFolder("trop profond")), null);
  let big = [];
  for (let i = 0; i < MAX_NODES; i++) big = addNode(big, null, makeModule("api:itunes"));
  assert.equal(addNode(big, null, makeModule("api:itunes")), null);
});

test("arbre : données externes assainies, partage compact", () => {
  const dirty = [{ type: "module", mod: "api:itunes" }, { type: "module", mod: "evil:x" }, { type: "folder", name: "<i>A", children: [{ type: "module", mod: "game:morpion" }, null, 5] }, "x"];
  const clean = sanitizeTree(dirty, isKnownModule);
  assert.equal(clean.length, 2);
  assert.equal(clean[1].name, "iA");
  const round = decodeTree(JSON.parse(JSON.stringify(encodeTree(clean))));
  assert.deepEqual(modulesOf(round), modulesOf(clean));
});

test("planète : l'arbre survit au lien de partage", () => {
  const tree = [makeFolder("Écoute", [makeModule("api:itunes"), makeFolder("Détente", [makeModule("api:openverse_audio")])]), makeModule("game:morpion")];
  const p = sanitizePlanet({ name: "Test", theme: "musique", band: 9, tree }, isKnownModule, THEME_IDS);
  assert.equal(count(p.tree), 5);
  const back = decodePlanet(encodePlanet(p), isKnownModule, THEME_IDS);
  assert.deepEqual(modulesOf(back.tree), modulesOf(p.tree));
  assert.equal(back.tree[0].name, "Écoute");
  const legacy = sanitizePlanet({ name: "Ancienne", theme: "musique", conns: ["itunes"] }, isKnownModule, THEME_IDS);
  assert.deepEqual(modulesOf(legacy.tree), ["api:itunes"]);
});

test("modules : catalogue cohérent, statuts honnêtes", () => {
  const ids = new Set();
  for (const m of MODULES) {
    assert.ok(!ids.has(m.id), "doublon " + m.id);
    ids.add(m.id);
    assert.ok(GROUPS.some((g) => g.id === m.group));
    assert.ok(BANDS.some((b) => b.id === m.minAge), m.id + " minAge");
    assert.ok(STATUS[m.status()], m.id + " statut");
    assert.ok(m.name && m.glyph && m.about);
    if (m.kind === "link") assert.ok(m.url.startsWith("https://"));
  }
  assert.equal(byModuleId("google:mail").status(), "demo", "sans connexion, la messagerie est une Démo");
  assert.equal(byModuleId("google:mail").minAge, 18);
  assert.equal(byModuleId("api:itunes").status(), "live");
  assert.ok(isKnownModule("game:nouveau-jeu") && !isKnownModule("game:Bad Id") && !isKnownModule("x:y"));
});

test("suggestions : thème + âge, rien de verrouillé n'est recommandé", () => {
  for (const t of THEMES) {
    for (const b of BANDS) {
      const all = suggestions(t.id, b.id).flatMap((g) => g.items);
      assert.ok(all.every((i) => !i.recommended || i.allowed));
      if (t.minAge <= b.id) assert.ok(all.some((i) => i.recommended), `${t.id}/${b.id} sans recommandation`);
    }
  }
  const kid = suggestions("musique", 5).flatMap((g) => g.items);
  assert.equal(kid.find((i) => i.module.id === "google:mail").allowed, false);
  assert.equal(kid.find((i) => i.module.id === "api:radiobrowser").allowed, false);
});

test("assistant : comprend météo, mails, drive, recherche", () => {
  assert.deepEqual(parse("Quel temps fait-il à Paris ?"), [{ kind: "weather", city: "Paris" }]);
  assert.deepEqual(parse("Est-ce que j'ai reçu des mails ?"), [{ kind: "mail" }]);
  const both = parse("ai-je reçu des mails et quelle est la météo à Saint-Denis ?");
  assert.deepEqual(both.map((i) => i.kind), ["mail", "weather"]);
  assert.equal(both[1].city, "Saint-Denis");
  assert.equal(parse("lion")[0].kind, "search");
  assert.equal(cityOf("quel temps fait-il"), null);
  assert.equal(driveTerm("cherche le fichier facture"), "facture");
  assert.equal(driveTerm("cherche le fichier devoirs"), "devoirs");
  assert.equal(driveTerm("mes documents sur les impots"), "impots");
  assert.equal(parse("cherche le fichier facture")[0].kind, "drive");
});

test("guide rapide : adapté à chaque âge", () => {
  const lens = BANDS.map((b) => quickGuide(b.id, "Mélodia").steps.length);
  assert.ok(lens.every((n) => n >= 4));
  assert.ok(lens[3] > lens[0], "le guide adulte est plus complet");
  for (const s of quickGuide(5, "Mélodia").steps) {
    assert.ok(s.p.length <= 70, "phrase trop longue pour 5-8 ans : " + s.p);
    assert.ok(!/(^|[^a-zà-ÿ])(api|oauth|clé|licence|google|démo)([^a-zà-ÿ]|$)/i.test(s.h + " " + s.p), "jargon pour 5-8 ans : " + s.h);
  }
  assert.ok(quickGuide(18).steps.some((s) => /Gmail/.test(s.h)));
  assert.ok(!quickGuide(9).steps.some((s) => /Gmail/.test(s.h + s.p)));
});

import { orbitLayout, orbitPos } from "../js/orbit.js";
test("orbite : toutes les planètes restent dans le cadre, quelle que soit la taille", () => {
  for (const [w, h] of [[375, 300], [900, 460], [1400, 460]]) {
    for (const n of [0, 1, 2, 5, 12]) {
      const lay = orbitLayout(n, w, h);
      assert.equal(lay.length, Math.max(n, 1));
      for (const o of lay) for (const t of [0, 7, 31, 120]) {
        const p = orbitPos(o, w, h, t);
        assert.ok(p.x - o.r >= 0 && p.x + o.r <= w && p.y - o.r >= 0 && p.y + o.r <= h, `hors cadre ${w}x${h} n=${n} t=${t}`);
      }
    }
  }
});

test("compatibilité : anciens liens et anciennes planètes toujours lisibles", () => {
  const old = Buffer.from(JSON.stringify({ n: "Vieille planète", e: "🎵", c: "#ff00aa", t: "musique", b: 9, x: ["itunes", "openverse_audio"] })).toString("base64url");
  const p = decodePlanet(old, isKnownModule, THEME_IDS);
  assert.ok(p, "ancien lien refusé");
  assert.deepEqual(modulesOf(p.tree), ["api:itunes", "api:openverse_audio"]);
  assert.equal(p.band, 9);
  assert.deepEqual(modulesOf(decodeTree(["api:itunes", "game:morpion"])), ["api:itunes", "game:morpion"]);
});

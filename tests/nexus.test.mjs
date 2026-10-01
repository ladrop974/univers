import test from "node:test";
import assert from "node:assert/strict";
import * as N from "../games/nexus/sim.js";

const run = (S, sec) => {
  const n = Math.round(sec / N.STEP);
  for (let i = 0; i < n && !S.over; i++) N.step(S);
  return S;
};

test("le monde est reproductible avec la même graine", () => {
  const a = N.makeWorld(1234),
    b = N.makeWorld(1234),
    c = N.makeWorld(99);
  assert.deepEqual(
    a.obstacles.map((o) => [o.x, o.z, o.r]),
    b.obstacles.map((o) => [o.x, o.z, o.r]),
  );
  assert.notDeepEqual(
    a.obstacles.map((o) => o.x),
    c.obstacles.map((o) => o.x),
  );
  assert.ok(a.nutrients.length >= 300);
  assert.ok(a.obstacles.length >= 100);
  assert.equal(a.frags.filter((f) => f.poi).length, 6);
  assert.equal(a.relays.length, 6);
  for (let k = 0; k < 6; k++) assert.ok(a.centers.some((c) => c.b === k) || k === 5);
});

test("les joueurs commencent à plus de 4000 unités, hors obstacles", () => {
  const S = N.createSim(7);
  const [p, q] = S.players;
  assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 4000);
  for (const pl of S.players) for (const o of S.W.obstacles) assert.ok(Math.hypot(pl.x - o.x, pl.z - o.z) > o.r + pl.r);
  const sig = N.rivalSignal(S, 0);
  assert.ok(!sig.exact, "le rival ne doit pas être visible au départ");
});

test("une mutation modifie les statistiques avec un compromis", () => {
  const S = N.createSim(3, { bots: [null, null] });
  const p = S.players[0];
  p.picks.push(["chitine", "cils", "machoire"]);
  const before = { ...p.st };
  assert.ok(N.pick(S, 0, "chitine"));
  assert.ok(p.st.armor > before.armor);
  assert.ok(p.st.speed < before.speed);
  assert.ok(!N.pick(S, 0, "chitine"), "on ne choisit que parmi les cartes proposées");
});

test("les collisions empêchent de traverser un obstacle", () => {
  const S = N.createSim(5, { bots: [null, null] });
  const p = S.players[0];
  const o = S.W.obstacles.find((x) => x.r > 30);
  p.x = o.x - o.r - p.r - 40;
  p.z = o.z;
  p.inv = 99;
  p.inp.mx = 1;
  run(S, 3);
  for (const ob of S.W.obstacles) assert.ok(Math.hypot(p.x - ob.x, p.z - ob.z) >= ob.r + p.r - 0.5);
});

test("robot contre robot : quatre actes, duel final et un vainqueur", () => {
  for (const seed of [11, 42, 2026]) {
    const S = N.createSim(seed, { bots: ["predateur", "rival"] });
    const acts = new Set();
    let duel = false;
    for (let t = 0; t < 25 * 60 && !S.over; t += 1) {
      run(S, 1);
      S.ev.length = 0;
      S.players.forEach((p) => acts.add(p.act));
      if (S.phase === "duel") duel = true;
    }
    const d = `graine ${seed} : t=${S.t | 0}s actes=${[...acts]} zen=${S.players.map((p) => p.zen | 0)} niveaux=${S.players.map((p) => p.level)}`;
    assert.ok(acts.has(3), "acte III atteint — " + d);
    assert.ok(duel, "duel atteint — " + d);
    assert.ok(S.over, "partie terminée — " + d);
    assert.ok(S.t > 4 * 60 && S.t < 25 * 60, "durée raisonnable — " + d);
    console.log("  ", d, "→", S.over.reason, "vainqueur", S.over.winner);
  }
});

test("le robot Éclaireur peut gagner ou perdre, jamais bloquer la partie", () => {
  const S = N.createSim(8, { bots: ["eclaireur", "eclaireur"] });
  run(S, 30 * 60);
  assert.ok(S.over || S.phase !== "world" || S.players.some((p) => p.act === 3), `t=${S.t | 0}`);
});

test("instantané réseau : l'invité reconstruit l'état", () => {
  const H = N.createSim(77, { bots: ["rival", "rival"] });
  run(H, 90);
  const G = N.createSim(77, { bots: [null, null] });
  N.applySnapshot(G, JSON.parse(JSON.stringify(N.snapshot(H, 1, true))));
  for (const i of [0, 1]) {
    assert.ok(Math.abs(G.players[i].nx - H.players[i].x) < 1);
    assert.equal(G.players[i].level, H.players[i].level);
    assert.deepEqual(G.players[i].muts, H.players[i].muts);
  }
  assert.equal(G.nut.filter((n) => n.alive).length, H.nut.filter((n) => n.alive).length);
  N.applySnapshot(G, { P: [{ v: ["x", 1e99] }], n: [[9999]], C: [[1, 2, 3], "bad"], O: "x" }); // données hostiles : pas d'exception
});

test("duel : trois balises gagnent la partie", () => {
  const S = N.createSim(9, { bots: [null, null] });
  N.startDuel(S, 0);
  run(S, N.PREP_TIME + 0.1);
  assert.equal(S.phase, "duel");
  const p = S.players[0];
  Object.assign(S.players[1], { inv: 999, x: N.ARENA.x, z: N.ARENA.z - 600 });
  for (const b of S.beacons.slice(0, 3)) {
    p.x = b.x;
    p.z = b.z;
    run(S, 3);
  }
  assert.ok(S.over);
  assert.equal(S.over.winner, 0);
});
